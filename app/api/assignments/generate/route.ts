import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'
import { generateAssignments } from '@/lib/assignment-engine'
import { z } from 'zod'

const schema = z.object({
  cycleId: z.string(),
  reviewersPerProject: z.number().min(1).max(10).default(4),
  maxProjectsPerDeveloper: z.number().min(1).max(10).default(3),
  previousCycleId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!isAdmin(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { cycleId, reviewersPerProject, maxProjectsPerDeveloper, previousCycleId } = parsed.data

  // Clear existing draft assignments for this cycle
  await db.projectAssignment.deleteMany({ where: { cycleId, locked: false } })

  const assignments = await generateAssignments({ cycleId, reviewersPerProject, maxProjectsPerDeveloper, previousCycleId })

  await db.projectAssignment.createMany({
    data: assignments.map(a => ({ ...a, cycleId, generatedBy: user.id })),
    skipDuplicates: true,
  })

  const result = await db.assignmentCycle.findUnique({
    where: { id: cycleId },
    include: {
      assignments: {
        include: { project: true, developer: true },
        orderBy: [{ project: { name: 'asc' } }, { developer: { name: 'asc' } }],
      },
    },
  })

  return NextResponse.json(result)
}
