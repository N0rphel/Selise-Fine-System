import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, visibleTeamIds, reporterTeamIds, allMemberTeamIds } from '@/lib/team-auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { computeFine, DUAL_FINE_RULES } from '@/lib/fine-calculator'

const schema = z.object({
  teamId: z.string().min(1),
  developerId: z.string().min(1),
  projectId: z.string().min(1),
  prLink: z.string().url().startsWith('https://github.com'),
  evidenceImages: z.array(z.string()).default([]),
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
  const permissions: string[] = user.permissions ?? []

  const { searchParams } = new URL(req.url)
  const where: any = { deletedAt: null }

  if (!isAdmin(permissions)) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myAllTeams = allMemberTeamIds(memberships)

    if (myAllTeams.length > 0) {
      // Any team member sees all violations from their team(s)
      where.teamId = { in: myAllTeams }
    } else {
      // No team — own violations only
      where.developerId = user.developerId ?? '__no_linked_developer__'
    }
  }

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
  const permissions: string[] = user.permissions ?? []

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { teamId, developerId, projectId, prLink, evidenceImages, approverDevId, status, items } = parsed.data

  if (!isAdmin(permissions)) {
    // Non-admin must be CAPTAIN or REPORTER for the target developer's team
    const memberships = await getUserTeamMemberships(user.developerId)
    const myReporterTeams = reporterTeamIds(memberships)
    if (!myReporterTeams.length) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const targetInTeam = await db.teamMember.findFirst({
      where: { developerId, teamId: { in: myReporterTeams } },
    })
    if (!targetInTeam) {
      return NextResponse.json({ error: 'You can only report violations for members of your team' }, { status: 403 })
    }
  }

  const fine = computeFine(items)

  const report = await db.violationReport.create({
    data: {
      teamId, developerId, projectId, prLink,
      evidenceImages,
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
        teamId,
        developerId: approverDevId,
        projectId,
        prLink,
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
