import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const VALID_ROLES = ['MEMBER', 'REPORTER', 'CAPTAIN', 'FINANCE'] as const

const addSchema = z.object({
  developerId: z.string().min(1),
  roles: z.array(z.enum(VALID_ROLES)).min(1).default(['MEMBER']),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: teamId } = await params
  const body = await req.json()
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const member = await db.teamMember.upsert({
    where: { teamId_developerId: { teamId, developerId: parsed.data.developerId } },
    update: { roles: parsed.data.roles },
    create: { teamId, developerId: parsed.data.developerId, roles: parsed.data.roles },
    include: { developer: { select: { id: true, name: true, employeeId: true } } },
  })

  return NextResponse.json(member, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: teamId } = await params
  const { developerId } = await req.json()
  if (!developerId) return NextResponse.json({ error: 'developerId required' }, { status: 400 })

  await db.teamMember.delete({
    where: { teamId_developerId: { teamId, developerId } },
  })

  return NextResponse.json({ ok: true })
}
