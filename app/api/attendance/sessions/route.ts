import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await db.prSession.findMany({
    orderBy: { date: 'desc' },
    include: {
      _count: { select: { attendances: true } },
      attendances: { select: { status: true } },
    },
  })

  return NextResponse.json(sessions)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { date, title } = await req.json()
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  const dateObj = new Date(date)
  dateObj.setUTCHours(0, 0, 0, 0)

  const existing = await db.prSession.findFirst({ where: { date: dateObj, status: 'SCHEDULED' } })
  if (existing) return NextResponse.json({ error: 'A session is already scheduled for that date' }, { status: 409 })

  // Pre-populate attendance records for all active developers
  const activeDevelopers = await db.developer.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true },
  })

  const prSession = await db.prSession.create({
    data: {
      date: dateObj,
      title: title || null,
      hostedBy: user.id,
      attendances: {
        create: activeDevelopers.map(d => ({ developerId: d.id, status: 'PENDING' })),
      },
    },
    include: { attendances: true },
  })

  return NextResponse.json(prSession, { status: 201 })
}
