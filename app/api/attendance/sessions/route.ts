import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds, getTeamDeveloperIds } from '@/lib/team-auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const permissions: string[] = user.permissions ?? []

  const where: any = {}
  if (!isAdmin(permissions)) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    if (myCaptainTeams.length > 0) {
      where.teamId = { in: myCaptainTeams }
    }
    // Plain members see all sessions (read-only, they're in the attendance records)
  }

  const sessions = await db.prSession.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      _count: { select: { attendances: true } },
      attendances: { select: { status: true } },
      team: { select: { id: true, name: true, slug: true } },
    },
  })

  return NextResponse.json(sessions)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const permissions: string[] = user.permissions ?? []
  const admin = isAdmin(permissions)

  const { date, title, teamId } = await req.json()
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  if (!admin) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    if (!teamId || !myCaptainTeams.includes(teamId)) {
      return NextResponse.json({ error: 'Forbidden — captains must specify their team' }, { status: 403 })
    }
  }

  const dateObj = new Date(date)
  dateObj.setUTCHours(0, 0, 0, 0)

  // Check for duplicate within the same team
  const existing = await db.prSession.findFirst({
    where: { date: dateObj, status: 'SCHEDULED', teamId: teamId ?? null },
  })
  if (existing) return NextResponse.json({ error: 'A session is already scheduled for that date' }, { status: 409 })

  // Populate attendance for the right developers (team-scoped or all active)
  let developerIds: string[]
  if (teamId) {
    developerIds = await getTeamDeveloperIds([teamId])
  } else {
    const devs = await db.developer.findMany({ where: { active: true, deletedAt: null }, select: { id: true } })
    developerIds = devs.map(d => d.id)
  }

  const prSession = await db.prSession.create({
    data: {
      date: dateObj,
      title: title || null,
      hostedBy: user.id,
      teamId: teamId ?? null,
      attendances: {
        create: developerIds.map(id => ({ developerId: id, status: 'PENDING' })),
      },
    },
    include: { attendances: true },
  })

  return NextResponse.json(prSession, { status: 201 })
}
