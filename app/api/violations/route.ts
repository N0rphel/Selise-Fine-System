import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'
import { z } from 'zod'
import { computeFine, DUAL_FINE_RULES } from '@/lib/fine-calculator'

const schema = z.object({
  developerId: z.string().min(1),
  projectId: z.string().min(1),
  prLink: z.string().url().startsWith('https://github.com'),
  evidence: z.string().optional(),
  approverDevId: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']).default('DRAFT'),
  items: z.array(z.object({
    ruleId: z.string(),
    ruleCode: z.string(),
    fineAmount: z.number(),
    multiplier: z.number().min(1).default(1),
    notes: z.string().optional(),
  })).min(1),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const { searchParams } = new URL(req.url)
  const where: any = { deletedAt: null }
  if (!isAdmin(user.permissions ?? []) && user.developerId) where.developerId = user.developerId
  if (searchParams.get('status')) where.status = searchParams.get('status')
  if (searchParams.get('projectId')) where.projectId = searchParams.get('projectId')
  if (searchParams.get('developerId')) where.developerId = searchParams.get('developerId')

  const violations = await db.violationReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { developer: true, project: true, reporter: true, items: { include: { rule: true } } },
  })

  return NextResponse.json(violations)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  if (!isAdmin(user.permissions ?? [])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { developerId, projectId, prLink, evidence, approverDevId, status, items } = parsed.data
  const fine = computeFine(items)

  const report = await db.violationReport.create({
    data: {
      developerId, projectId, prLink,
      evidence: evidence ?? null,
      reporterId: user.id,
      status,
      totalFine: fine.developerTotal,
      items: {
        create: items.map(i => ({
          ruleId: i.ruleId,
          multiplier: i.multiplier,
          fineAmount: i.fineAmount * i.multiplier,
          notes: i.notes ?? null,
        })),
      },
    },
  })

  await db.auditLog.create({
    data: {
      entityType: 'ViolationReport',
      entityId: report.id,
      action: status === 'DRAFT' ? 'Created as Draft' : 'Created & Submitted',
      userId: user.id,
      reportId: report.id,
    },
  })

  // SEL_PULL008: auto-generate approver violation
  const hasDual = items.some(i => DUAL_FINE_RULES.has(i.ruleCode))
  if (hasDual && approverDevId) {
    const pull008 = items.find(i => DUAL_FINE_RULES.has(i.ruleCode))!
    const approverReport = await db.violationReport.create({
      data: {
        developerId: approverDevId,
        projectId,
        prLink,
        evidence: `Auto-generated: Approver fine for SEL_PULL008 on PR by developer`,
        reporterId: user.id,
        status,
        totalFine: 50,
        items: {
          create: [{
            ruleId: pull008.ruleId,
            multiplier: 1,
            fineAmount: 50,
            notes: 'Approver fine (50) — auto-generated for SEL_PULL008',
          }],
        },
      },
    })
    await db.auditLog.create({
      data: {
        entityType: 'ViolationReport',
        entityId: approverReport.id,
        action: 'Auto-generated approver fine (SEL_PULL008)',
        userId: user.id,
        reportId: approverReport.id,
      },
    })
  }

  return NextResponse.json({ id: report.id }, { status: 201 })
}
