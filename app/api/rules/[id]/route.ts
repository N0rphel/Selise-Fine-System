import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function canManageRule(userId: string, developerId: string | null, permissions: string[], ruleId: string): Promise<boolean> {
  if (isAdmin(permissions)) return true
  const rule = await db.violationRule.findUnique({ where: { id: ruleId }, select: { teamId: true } })
  if (!rule?.teamId) return false // global rules: admin only
  const memberships = await getUserTeamMemberships(developerId)
  return captainTeamIds(memberships).includes(rule.teamId)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const { id } = await params

  if (!await canManageRule(user.id, user.developerId, user.permissions ?? [], id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await req.json()
  const rule = await db.violationRule.update({ where: { id }, data })

  await db.auditLog.create({
    data: { entityType: 'ViolationRule', entityId: id, action: 'Rule Updated', details: JSON.stringify(data), userId: user.id },
  })

  return NextResponse.json(rule)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const { id } = await params

  if (!await canManageRule(user.id, user.developerId, user.permissions ?? [], id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.violationRule.update({ where: { id }, data: { deletedAt: new Date(), active: false } })
  return NextResponse.json({ ok: true })
}
