import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const prSession = await db.prSession.findUnique({
    where: { id },
    include: {
      attendances: {
        include: { developer: true },
        orderBy: { developer: { name: 'asc' } },
      },
    },
  })
  if (!prSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(prSession)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const admin = isAdmin(user.permissions ?? [])

  const { id } = await params
  const { status, cancelNote, title } = await req.json()

  const prSession = await db.prSession.findUnique({ where: { id } })
  if (!prSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!admin) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    if (!prSession.teamId || !myCaptainTeams.includes(prSession.teamId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const updated = await db.prSession.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(cancelNote !== undefined ? { cancelNote } : {}),
      ...(title !== undefined ? { title } : {}),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await db.prSession.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
