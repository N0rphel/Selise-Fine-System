import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
})

async function canManage(userId: string, permissions: string[], projectId: string): Promise<boolean> {
  if (isAdmin(permissions)) return true
  const project = await db.project.findUnique({ where: { id: projectId }, select: { teamId: true } })
  if (!project?.teamId) return false
  const developer = await db.developer.findFirst({ where: { user: { id: userId } }, select: { id: true } })
  if (!developer) return false
  const memberships = await getUserTeamMemberships(developer.id)
  return captainTeamIds(memberships).includes(project.teamId)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const { id } = await params

  if (!await canManage(user.id, user.permissions ?? [], id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const project = await db.project.update({ where: { id }, data: parsed.data })
  return NextResponse.json(project)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const { id } = await params

  if (!await canManage(user.id, user.permissions ?? [], id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.project.update({ where: { id }, data: { deletedAt: new Date(), active: false } })
  return NextResponse.json({ ok: true })
}
