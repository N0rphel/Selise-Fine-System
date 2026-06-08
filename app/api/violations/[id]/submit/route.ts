import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const { id } = await params

  const v = await db.violationReport.findUnique({ where: { id: id } })
  if (!v || v.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (v.status !== 'DRAFT') return NextResponse.json({ error: 'Only drafts can be submitted' }, { status: 400 })

  await db.violationReport.update({ where: { id: id }, data: { status: 'SUBMITTED' } })
  await db.auditLog.create({
    data: { entityType: 'ViolationReport', entityId: id, action: 'Submitted for Review', userId: user.id, reportId: id },
  })

  return NextResponse.json({ ok: true })
}
