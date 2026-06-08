import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { NextResponse } from 'next/server'

// GET all attendance records for a session
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const records = await db.attendance.findMany({
    where: { sessionId: id },
    include: { developer: true },
    orderBy: { developer: { name: 'asc' } },
  })
  return NextResponse.json(records)
}

// PATCH — bulk update or single update attendance status
// Body: { records: [{ developerId, status, reason? }] }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { records } = await req.json() as { records: { developerId: string; status: string; reason?: string }[] }

  if (!records || !Array.isArray(records)) return NextResponse.json({ error: 'records array required' }, { status: 400 })

  const prSession = await db.prSession.findUnique({ where: { id } })
  if (!prSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const updated = await Promise.all(
    records.map(r =>
      db.attendance.upsert({
        where: { sessionId_developerId: { sessionId: id, developerId: r.developerId } },
        create: { sessionId: id, developerId: r.developerId, status: r.status, reason: r.reason ?? null },
        update: { status: r.status, reason: r.reason ?? null },
      })
    )
  )

  return NextResponse.json(updated)
}
