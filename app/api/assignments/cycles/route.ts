import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cycles = await db.assignmentCycle.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      _count: { select: { assignments: true } },
    },
  })
  return NextResponse.json(cycles)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Handle manual add-assignment shortcut
  if (body.cycleId && body.projectId && body.developerId) {
    const a = await db.projectAssignment.upsert({
      where: { projectId_cycleId_developerId: { projectId: body.projectId, cycleId: body.cycleId, developerId: body.developerId } },
      update: {},
      create: { projectId: body.projectId, cycleId: body.cycleId, developerId: body.developerId, generatedBy: user.id },
    })
    return NextResponse.json(a, { status: 201 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const cycle = await db.assignmentCycle.create({
    data: {
      name: parsed.data.name,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      status: 'DRAFT',
      generatedBy: user.id,
    },
  })
  return NextResponse.json(cycle, { status: 201 })
}
