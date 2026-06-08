import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const cycle = await db.assignmentCycle.findUnique({
    where: { id },
    include: {
      assignments: {
        include: { project: true, developer: true },
        orderBy: [{ project: { name: 'asc' } }, { developer: { name: 'asc' } }],
      },
    },
  })
  if (!cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(cycle)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const { id } = await params
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const data = await req.json()
  const cycle = await db.assignmentCycle.update({ where: { id: id }, data })
  return NextResponse.json(cycle)
}
