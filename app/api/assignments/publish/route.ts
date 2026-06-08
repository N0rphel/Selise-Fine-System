import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { cycleId } = await req.json()

  // Deactivate any currently active cycle
  await db.assignmentCycle.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'COMPLETED' } })

  await db.assignmentCycle.update({ where: { id: cycleId }, data: { status: 'ACTIVE' } })

  return NextResponse.json({ ok: true })
}
