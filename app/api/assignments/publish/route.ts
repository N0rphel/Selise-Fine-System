import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const admin = isAdmin(user.permissions ?? [])

  const { cycleId } = await req.json()

  if (!admin) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    const cycle = await db.assignmentCycle.findUnique({ where: { id: cycleId }, select: { teamId: true } })
    if (!cycle?.teamId || !myCaptainTeams.includes(cycle.teamId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Deactivate any currently active cycle for this team (or global if admin)
  await db.assignmentCycle.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'COMPLETED' } })

  await db.assignmentCycle.update({ where: { id: cycleId }, data: { status: 'ACTIVE' } })

  return NextResponse.json({ ok: true })
}
