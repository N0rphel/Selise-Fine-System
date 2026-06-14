import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { db } from '@/lib/db'
import { AssignmentsClient } from './assignments-client'

export default async function AssignmentsPage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? []
  const admin = isAdmin(permissions)

  const memberships = await getUserTeamMemberships(user.developerId)
  const myCaptainTeams = admin ? [] : captainTeamIds(memberships)
  const canManage = admin || myCaptainTeams.length > 0

  const where: any = {}
  if (!admin) {
    if (myCaptainTeams.length > 0) {
      where.teamId = { in: myCaptainTeams }
    }
    // Plain members see all published cycles (read-only)
    else {
      where.status = 'PUBLISHED'
    }
  }

  const [cycles, captainTeams] = await Promise.all([
    db.assignmentCycle.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { assignments: true } },
        team: { select: { id: true, name: true, slug: true } },
      },
    }),
    myCaptainTeams.length > 0
      ? db.team.findMany({ where: { id: { in: myCaptainTeams }, deletedAt: null }, select: { id: true, name: true, slug: true } })
      : [],
  ])

  return <AssignmentsClient cycles={cycles} canManage={canManage} isAdmin={admin} captainTeams={captainTeams} />
}
