import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, financeTeamIds } from '@/lib/team-auth'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const memberships = await getUserTeamMemberships(user.developerId)
  const hasAccess = isAdmin(user.permissions ?? []) || financeTeamIds(memberships).length > 0
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await db.withdrawal.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
