import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { canViewFinance } from '@/lib/permissions'

// Finance rejects a submitted payment (developer may resubmit)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!canViewFinance(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const payment = await db.payment.findUnique({ where: { id } })
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (payment.status !== 'SUBMITTED') return NextResponse.json({ error: 'Payment is not awaiting confirmation' }, { status: 400 })

  const { note } = await req.json()

  const updated = await db.payment.update({
    where: { id },
    data: { status: 'REJECTED', confirmedById: user.id, confirmedAt: new Date(), rejectionNote: note ?? null },
  })

  await db.auditLog.create({
    data: {
      entityType: 'Payment', entityId: id,
      action: 'Payment rejected',
      details: note ?? undefined,
      userId: user.id,
    },
  })

  return NextResponse.json(updated)
}
