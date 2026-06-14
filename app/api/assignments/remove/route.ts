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

  const { assignmentId } = await req.json()
  const a = await db.projectAssignment.findUnique({
    where: { id: assignmentId },
    include: { cycle: { select: { teamId: true } } },
  })
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (a.locked) return NextResponse.json({ error: 'Assignment is locked' }, { status: 400 })

  if (!admin) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    if (!a.cycle.teamId || !myCaptainTeams.includes(a.cycle.teamId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  await db.projectAssignment.delete({ where: { id: assignmentId } })
  return NextResponse.json({ ok: true })
}
