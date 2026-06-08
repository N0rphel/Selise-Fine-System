import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  projectCode: z.string().min(1).max(20).toUpperCase(),
  name: z.string().min(1),
  type: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean().default(true),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const projects = await db.project.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const project = await db.project.create({ data: parsed.data })
  return NextResponse.json(project, { status: 201 })
}
