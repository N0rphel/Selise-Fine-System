import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(20).toUpperCase(),
  description: z.string().optional(),
  budgetAmount: z.number().min(0).default(0),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const teams = await db.team.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { members: true, rules: true } },
      financeAccount: { select: { id: true, accountName: true, bankName: true } },
    },
  })

  return NextResponse.json(teams)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const exists = await db.team.findUnique({ where: { slug: parsed.data.slug } })
  if (exists) return NextResponse.json({ error: `Team slug "${parsed.data.slug}" already exists` }, { status: 409 })

  const team = await db.team.create({ data: parsed.data })
  return NextResponse.json(team, { status: 201 })
}
