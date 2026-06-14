import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, financeTeamIds } from '@/lib/team-auth'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
  description: z.string().optional().nullable(),
  evidenceImages: z.array(z.string()).default([]),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const withdrawals = await db.withdrawal.findMany({
    orderBy: { createdAt: 'desc' },
    include: { withdrawnBy: { select: { name: true } } },
  })

  return NextResponse.json(withdrawals)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const memberships = await getUserTeamMemberships(user.developerId)
  const hasAccess = isAdmin(user.permissions ?? []) || financeTeamIds(memberships).length > 0
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { amount, reason, description, evidenceImages } = parsed.data

  const withdrawal = await db.withdrawal.create({
    data: { amount, reason, description: description ?? null, evidenceImages, withdrawnById: user.id },
  })

  await db.auditLog.create({
    data: {
      entityType: 'Withdrawal',
      entityId: withdrawal.id,
      action: `Withdrawal of Nu. ${amount.toFixed(2)} recorded — ${reason}`,
      userId: user.id,
    },
  })

  return NextResponse.json(withdrawal, { status: 201 })
}
