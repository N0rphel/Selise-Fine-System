import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const { id } = await params

  const v = await db.violationReport.findUnique({ where: { id } })
  if (!v || v.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!isAdmin(user.permissions ?? [])) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    if (!myCaptainTeams.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const targetInTeam = await db.teamMember.findFirst({
      where: { developerId: v.developerId, teamId: { in: myCaptainTeams } },
    })
    if (!targetInTeam) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (v.status !== 'SUBMITTED') {
    return NextResponse.json({ error: 'Can only review submitted violations' }, { status: 400 })
  }

  await db.violationReport.update({ where: { id }, data: { status: 'UNDER_REVIEW' } })
  await db.auditLog.create({
    data: { entityType: 'ViolationReport', entityId: id, action: 'Marked Under Review', userId: user.id, reportId: id },
  })

  return NextResponse.json({ ok: true })
}
