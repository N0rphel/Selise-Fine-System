import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  projectCode: z.string().min(1).max(40).toUpperCase(),
  name: z.string().min(1),
  type: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean().default(true),
  teamId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const permissions: string[] = user.permissions ?? []
  const { searchParams } = new URL(req.url)
  const teamId = searchParams.get('teamId')

  const where: any = { deletedAt: null }

  if (isAdmin(permissions)) {
    if (teamId) where.teamId = teamId
  } else {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    if (myCaptainTeams.length > 0) {
      where.teamId = teamId && myCaptainTeams.includes(teamId)
        ? teamId
        : { in: myCaptainTeams }
    }
    // Plain members: see all active projects (read-only, needed for violation form)
  }

  const projects = await db.project.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { team: { select: { id: true, name: true, slug: true } } },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const admin = isAdmin(user.permissions ?? [])

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { teamId, ...rest } = parsed.data

  if (!admin) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myCaptainTeams = captainTeamIds(memberships)
    if (!teamId || !myCaptainTeams.includes(teamId)) {
      return NextResponse.json({ error: 'Forbidden — captains must specify their team' }, { status: 403 })
    }
  }

  const project = await db.project.create({ data: { ...rest, teamId: teamId ?? null } })
  return NextResponse.json(project, { status: 201 })
}
