import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  code: z.string().min(1).toUpperCase(),
  category: z.string().min(1),
  description: z.string().min(1),
  fineAmount: z.number().positive(),
  active: z.boolean().default(true),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rules = await db.violationRule.findMany({
    where: { deletedAt: null },
    orderBy: [{ category: 'asc' }, { code: 'asc' }],
  })
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const rule = await db.violationRule.create({ data: parsed.data })
  return NextResponse.json(rule, { status: 201 })
}
