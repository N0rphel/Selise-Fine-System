import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  githubUsername: z.string().optional(),
  department: z.string().min(1),
  team: z.string().optional(),
  active: z.boolean().default(true),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const developers = await db.developer.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { violations: true, assignments: true } },
    },
  })
  return NextResponse.json(developers)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const dev = await db.developer.create({ data: parsed.data })
  return NextResponse.json(dev, { status: 201 })
}
