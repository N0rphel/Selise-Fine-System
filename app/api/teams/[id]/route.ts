import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  budgetAmount: z.number().min(0).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const team = await db.team.findFirst({
    where: { id, deletedAt: null },
    include: {
      members: {
        include: { developer: { select: { id: true, name: true, employeeId: true, githubUsername: true, department: true } } },
        orderBy: { createdAt: 'asc' },
      },
      rules: { where: { deletedAt: null }, orderBy: { category: 'asc' } },
      financeAccount: true,
    },
  })

  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(team)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const team = await db.team.update({ where: { id }, data: parsed.data })
  return NextResponse.json(team)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await db.team.update({ where: { id }, data: { deletedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
