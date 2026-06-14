import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, financeTeamIds } from '@/lib/team-auth'

// Finance confirms a submitted payment
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const memberships = await getUserTeamMemberships(user.developerId)
  const hasAccess = isAdmin(user.permissions ?? []) || financeTeamIds(memberships).length > 0
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const payment = await db.payment.findUnique({ where: { id } })
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (payment.status !== 'SUBMITTED') return NextResponse.json({ error: 'Payment is not awaiting confirmation' }, { status: 400 })

  const updated = await db.payment.update({
    where: { id },
    data: { status: 'CONFIRMED', confirmedById: user.id, confirmedAt: new Date(), rejectionNote: null },
  })

  await db.auditLog.create({
    data: {
      entityType: 'Payment', entityId: id,
      action: 'Payment confirmed',
      userId: user.id,
    },
  })

  return NextResponse.json(updated)
}
