import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { canViewFinance } from '@/lib/permissions'

// Finance lists payments (optionally filter by status)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!canViewFinance(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const payments = await db.payment.findMany({
    where: status ? { status } : undefined,
    orderBy: { submittedAt: 'desc' },
    include: {
      violations: { include: { developer: true, project: true } },
    },
  })

  return NextResponse.json(payments)
}

// Developer submits ONE payment proof covering one or more of their approved fines
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const { violationIds, screenshotBase64, reference, note } = await req.json()
  if (!Array.isArray(violationIds) || violationIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one fine to pay' }, { status: 400 })
  }

  const violations = await db.violationReport.findMany({
    where: { id: { in: violationIds }, deletedAt: null },
    include: { payment: true },
  })

  if (violations.length !== violationIds.length) {
    return NextResponse.json({ error: 'Some fines were not found' }, { status: 404 })
  }

  for (const v of violations) {
    if (v.developerId !== user.developerId) {
      return NextResponse.json({ error: 'You can only pay your own fines' }, { status: 403 })
    }
    if (v.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Only approved fines can be paid' }, { status: 400 })
    }
    if (v.payment && (v.payment.status === 'CONFIRMED' || v.payment.status === 'SUBMITTED')) {
      return NextResponse.json({ error: 'One or more fines already have a pending or confirmed payment' }, { status: 400 })
    }
  }

  const amount = violations.reduce((s, v) => s + v.totalFine, 0)

  const payment = await db.payment.create({
    data: {
      amount,
      screenshotBase64: screenshotBase64 ?? null,
      reference: reference ?? null,
      note: note ?? null,
      status: 'SUBMITTED',
      submittedById: user.id,
      // (re)link the selected violations to this payment
      violations: { connect: violationIds.map((id: string) => ({ id })) },
    },
  })

  await db.auditLog.create({
    data: {
      entityType: 'Payment', entityId: payment.id,
      action: `Payment proof submitted for ${violations.length} fine(s)`,
      details: reference ? `Ref: ${reference}` : undefined,
      userId: user.id,
      reportId: violationIds[0],
    },
  })

  return NextResponse.json(payment, { status: 201 })
}
