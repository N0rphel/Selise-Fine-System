import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  code: z.string().min(1).toUpperCase(),
  category: z.string().min(1),
  description: z.string().min(1),
  fineAmount: z.number().positive(),
  active: z.boolean().default(true),
  teamId: z.string().optional().nullable(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rules = await db.violationRule.findMany({
    where: { deletedAt: null },
    orderBy: [{ category: 'asc' }, { code: 'asc' }],
  })
  return NextResponse.json(rules)
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
    // CAPTAINs can only create rules for their own teams
    if (!teamId) return NextResponse.json({ error: 'CAPTAINs must assign a rule to their team' }, { status: 403 })
    const memberships = await getUserTeamMemberships(user.developerId)
    const myTeams = captainTeamIds(memberships)
    if (!myTeams.includes(teamId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rule = await db.violationRule.create({ data: { ...rest, teamId: teamId ?? null } })
  return NextResponse.json(rule, { status: 201 })
}
