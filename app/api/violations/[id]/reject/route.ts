import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const { id } = await params

  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const v = await db.violationReport.findUnique({ where: { id: id } })
  if (!v || v.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(v.status)) return NextResponse.json({ error: 'Cannot reject at this stage' }, { status: 400 })

  const { note } = await req.json()
  await db.violationReport.update({
    where: { id: id },
    data: { status: 'REJECTED', rejectionNote: note ?? null },
  })
  await db.auditLog.create({
    data: {
      entityType: 'ViolationReport', entityId: id,
      action: 'Rejected',
      details: note ?? undefined,
      userId: user.id, reportId: id,
    },
  })

  return NextResponse.json({ ok: true })
}
