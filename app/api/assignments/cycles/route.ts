import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  teamId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const permissions: string[] = user.permissions ?? []

  const where: any = {}
  if (!isAdmin(permissions)) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    // Non-admins see cycles for their captain teams only
    if (myCaptainTeams.length > 0) {
      where.teamId = { in: myCaptainTeams }
    } else {
      // Plain members: see all published cycles (readonly)
      where.status = 'PUBLISHED'
    }
  }

  const cycles = await db.assignmentCycle.findMany({
    where,
    orderBy: { startDate: 'desc' },
    include: { _count: { select: { assignments: true } }, team: { select: { id: true, name: true, slug: true } } },
  })
  return NextResponse.json(cycles)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const permissions: string[] = user.permissions ?? []
  const admin = isAdmin(permissions)

  const body = await req.json()

  // Manual add-assignment shortcut
  if (body.cycleId && body.projectId && body.developerId) {
    if (!admin) {
      const memberships = await getUserTeamMemberships(user.developerId)
      const myCaptainTeams = captainTeamIds(memberships)
      const cycle = await db.assignmentCycle.findUnique({ where: { id: body.cycleId }, select: { teamId: true } })
      if (!cycle?.teamId || !myCaptainTeams.includes(cycle.teamId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    const a = await db.projectAssignment.upsert({
      where: { projectId_cycleId_developerId: { projectId: body.projectId, cycleId: body.cycleId, developerId: body.developerId } },
      update: {},
      create: { projectId: body.projectId, cycleId: body.cycleId, developerId: body.developerId, generatedBy: user.id },
    })
    return NextResponse.json(a, { status: 201 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, startDate, endDate, teamId } = parsed.data

  if (!admin) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    if (!teamId || !myCaptainTeams.includes(teamId)) {
      return NextResponse.json({ error: 'Forbidden — captains must specify their team' }, { status: 403 })
    }
  }

  const cycle = await db.assignmentCycle.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'DRAFT',
      generatedBy: user.id,
      teamId: teamId ?? null,
    },
  })
  return NextResponse.json(cycle, { status: 201 })
}
