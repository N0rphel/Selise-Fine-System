import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'
import { isAdmin, withBaseline } from '@/lib/permissions'
import { z } from 'zod'

const schema = z.object({
  permissions: z.array(z.enum(['ADMIN', 'FINANCE', 'DEVELOPER'])).default([]),
  developerId: z.string().nullable().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const { id } = await params
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { developerId } = parsed.data
  // Every user is always a developer — enforce the baseline server-side.
  const permissions = withBaseline(parsed.data.permissions)

  const updated = await db.user.update({
    where: { id: id },
    data: { permissions, developerId: developerId ?? null },
  })

  await db.auditLog.create({
    data: {
      entityType: 'User',
      entityId: id,
      action: `Permissions updated to [${permissions.join(', ')}]`,
      userId: user.id,
    },
  })

  return NextResponse.json(updated)
}
