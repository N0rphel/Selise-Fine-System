import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'

const schema = z.object({
  method: z.enum(['manual', 'random', 'least-rotations', 'shortest-duration']),
  userId: z.string().optional(),
  teamId: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const teamId = req.nextUrl.searchParams.get('teamId')

  const rotations = await db.prOwnerRotation.findMany({
    where: teamId ? { teamId } : undefined,
    orderBy: { startedAt: 'desc' },
    include: { user: true, rotatedBy: true },
  })

  return NextResponse.json(rotations)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const actor = session.user as any

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { method, userId: manualUserId, teamId } = parsed.data

  // Allow ADMIN or team CAPTAIN for this specific team
  if (!isAdmin(actor.permissions ?? [])) {
    const memberships = await getUserTeamMemberships(actor.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    if (!myCaptainTeams.includes(teamId)) {
      return NextResponse.json({ error: 'Forbidden — you are not captain of this team' }, { status: 403 })
    }
  }

  // Candidates = Users linked to developers who are team members of this team
  const teamMembers = await db.teamMember.findMany({
    where: { teamId },
    include: { developer: { include: { user: true } } },
  })
  const candidateUsers = teamMembers
    .map(m => m.developer.user)
    .filter((u): u is NonNullable<typeof u> => u !== null)

  if (candidateUsers.length === 0) {
    return NextResponse.json({ error: 'No team members with user accounts to rotate' }, { status: 400 })
  }

  // Active rotation for this team
  const activeRotation = await db.prOwnerRotation.findFirst({
    where: { teamId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  })
  const currentOwnerId = activeRotation?.userId ?? null

  const candidates = candidateUsers.filter(u => u.id !== currentOwnerId)
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No eligible candidates (only current captain in team)' }, { status: 400 })
  }

  let newOwnerId: string

  if (method === 'manual') {
    if (!manualUserId) return NextResponse.json({ error: 'userId required for manual rotation' }, { status: 400 })
    if (!candidates.find(u => u.id === manualUserId)) {
      return NextResponse.json({ error: 'Selected user is not a team member or is already captain' }, { status: 400 })
    }
    newOwnerId = manualUserId
  } else if (method === 'random') {
    newOwnerId = candidates[Math.floor(Math.random() * candidates.length)].id
  } else {
    const allRotations = await db.prOwnerRotation.findMany({ where: { teamId } })
    const now = new Date()

    const stats = candidates.map(u => {
      const mine = allRotations.filter(r => r.userId === u.id)
      const count = mine.length
      const totalMs = mine.reduce((sum, r) => {
        return sum + ((r.endedAt ?? now).getTime() - r.startedAt.getTime())
      }, 0)
      return { userId: u.id, count, totalMs }
    })

    if (method === 'least-rotations') {
      const min = Math.min(...stats.map(s => s.count))
      const tied = stats.filter(s => s.count === min)
      newOwnerId = tied[Math.floor(Math.random() * tied.length)].userId
    } else {
      const min = Math.min(...stats.map(s => s.totalMs))
      const tied = stats.filter(s => s.totalMs === min)
      newOwnerId = tied[Math.floor(Math.random() * tied.length)].userId
    }
  }

  const newOwner = candidateUsers.find(u => u.id === newOwnerId)
  if (!newOwner) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const now = new Date()

  // Close the active rotation for this team (if any)
  if (activeRotation) {
    await db.prOwnerRotation.update({
      where: { id: activeRotation.id },
      data: { endedAt: now },
    })
  }

  // Create new rotation record — no permission changes
  const rotation = await db.prOwnerRotation.create({
    data: { userId: newOwnerId, teamId, rotatedById: actor.id, startedAt: now },
  })

  await db.auditLog.create({
    data: {
      entityType: 'PrOwnerRotation',
      entityId:   rotation.id,
      action:     `PR captain rotated to ${newOwner.name} for team ${teamId} (method: ${method})`,
      userId:     actor.id,
    },
  })

  return NextResponse.json({ id: rotation.id, newOwner: newOwner.name }, { status: 201 })
}
