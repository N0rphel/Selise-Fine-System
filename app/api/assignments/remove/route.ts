import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { assignmentId } = await req.json()
  const a = await db.projectAssignment.findUnique({ where: { id: assignmentId } })
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (a.locked) return NextResponse.json({ error: 'Assignment is locked' }, { status: 400 })

  await db.projectAssignment.delete({ where: { id: assignmentId } })
  return NextResponse.json({ ok: true })
}
