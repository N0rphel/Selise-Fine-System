import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserTeamMemberships, financeTeamIds } from '@/lib/team-auth'

const schema = z.object({
  accountName:   z.string().min(1),
  accountNumber: z.string().min(1),
  bankName:      z.string().optional().nullable(),
  notes:         z.string().optional().nullable(),
  qrCodeBase64:  z.string().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const account = await db.financeAccount.findUnique({ where: { teamId: id } })
  return NextResponse.json(account ?? null)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const { id } = await params

  if (!isAdmin(user.permissions ?? [])) {
    const memberships = await getUserTeamMemberships(user.developerId)
    if (!financeTeamIds(memberships).includes(id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const account = await db.financeAccount.upsert({
    where:  { teamId: id },
    update: { ...parsed.data, updatedBy: user.id },
    create: { ...parsed.data, teamId: id, createdBy: user.id },
  })

  return NextResponse.json(account)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const { id } = await params

  if (!isAdmin(user.permissions ?? [])) {
    const memberships = await getUserTeamMemberships(user.developerId)
    if (!financeTeamIds(memberships).includes(id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  await db.financeAccount.deleteMany({ where: { teamId: id } })
  return NextResponse.json({ ok: true })
}
