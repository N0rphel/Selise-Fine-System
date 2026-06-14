import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { AttendanceClient } from './attendance-client'

export default async function AttendancePage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? []
  const admin = isAdmin(permissions)

  const memberships = await getUserTeamMemberships(user.developerId)
  const myCaptainTeams = admin ? [] : captainTeamIds(memberships)
  const canManage = admin || myCaptainTeams.length > 0

  const where: any = {}
  if (!admin && myCaptainTeams.length > 0) {
    where.teamId = { in: myCaptainTeams }
  }

  const [raw, captainTeams] = await Promise.all([
    db.prSession.findMany({
      where,
      include: {
        attendances: { select: { status: true } },
        team: { select: { id: true, name: true, slug: true } },
      },
    }),
    myCaptainTeams.length > 0
      ? db.team.findMany({ where: { id: { in: myCaptainTeams }, deletedAt: null }, select: { id: true, name: true, slug: true } })
      : [],
  ])

  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

  const upcoming = raw.filter(s => s.date >= todayUTC).sort((a, b) => a.date.getTime() - b.date.getTime())
  const past     = raw.filter(s => s.date <  todayUTC).sort((a, b) => b.date.getTime() - a.date.getTime())

  const serialized = [...upcoming, ...past].map(s => ({
    id:           s.id,
    date:         s.date.toISOString(),
    title:        s.title,
    status:       s.status,
    cancelNote:   s.cancelNote,
    teamId:       s.team?.id ?? null,
    teamSlug:     s.team?.slug ?? null,
    presentCount: s.attendances.filter(a => a.status === 'PRESENT').length,
    absentCount:  s.attendances.filter(a => a.status === 'ABSENT').length,
    excusedCount: s.attendances.filter(a => a.status === 'EXCUSED').length,
    pendingCount: s.attendances.filter(a => a.status === 'PENDING').length,
    totalDevs:    s.attendances.length,
  }))

  return <AttendanceClient sessions={serialized} isAdmin={admin} canManage={canManage} captainTeams={captainTeams} />
}
