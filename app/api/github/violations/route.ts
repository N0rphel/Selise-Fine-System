import { db } from '@/lib/db'
import { computeFine, DUAL_FINE_RULES } from '@/lib/fine-calculator'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const SYNC_SECRET = process.env.GITHUB_SYNC_SECRET
const SYNC_USER = process.env.GITHUB_SYNC_USER ?? 'github'

function authorize(req: NextRequest): boolean {
  if (!SYNC_SECRET) return false
  const header = req.headers.get('authorization') ?? ''

  if (header === `Bearer ${SYNC_SECRET}`) return true

  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
    const sep = decoded.indexOf(':')
    if (sep === -1) return false
    const user = decoded.slice(0, sep)
    const pass = decoded.slice(sep + 1)
    return user === SYNC_USER && pass === SYNC_SECRET
  }

  return false
}

function repoFromPrLink(prLink: string): string {
  // https://github.com/org/repo/pull/123  →  repo
  const m = prLink.match(/^https:\/\/github\.com\/[^/]+\/([^/]+)\/pull\//)
  return m ? m[1] : prLink
}

const schema = z.object({
  githubUsername: z.string().min(1),
  approverGithubUsername: z.string().optional(),
  teamSlug: z.string().optional(),
  projectName: z.string().min(1),
  prLink: z.string().url().startsWith('https://github.com'),
  status: z.enum(['DRAFT', 'SUBMITTED']).default('DRAFT'),
  items: z.array(z.object({
    ruleCode: z.string().min(1),
    category: z.string().default('Pull Request'),
    description: z.string().min(1),
    fineAmount: z.number().positive(),
    multiplier: z.number().int().min(1).default(1),
    notes: z.string().optional(),
  })).min(1),
})

// GET /api/github/violations?prLink=<url>  — check existing violations for a PR
export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prLink = new URL(req.url).searchParams.get('prLink')
  if (!prLink) return NextResponse.json({ error: 'prLink query param required' }, { status: 400 })

  const violations = await db.violationReport.findMany({
    where: { prLink, deletedAt: null },
    select: {
      id: true, status: true, totalFine: true, createdAt: true,
      developer: { select: { githubUsername: true, name: true } },
      project: { select: { projectCode: true, name: true } },
      items: { include: { rule: { select: { code: true, description: true } } } },
    },
  })

  return NextResponse.json(violations)
}

// POST /api/github/violations  — create a violation from a GitHub Actions workflow
export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { githubUsername, approverGithubUsername, teamSlug, projectName, prLink, status, items } = parsed.data
  const projectCode = repoFromPrLink(prLink)

  const developer = await db.developer.findFirst({
    where: { githubUsername, deletedAt: null },
    include: { teamMembers: { select: { teamId: true } } },
  })
  if (!developer) {
    return NextResponse.json({ error: `Developer "${githubUsername}" not found` }, { status: 422 })
  }

  // Resolve team: explicit slug → auto-detect from single membership → null
  let team: { id: string } | null = null
  if (teamSlug) {
    team = await db.team.findFirst({ where: { slug: teamSlug.toUpperCase(), deletedAt: null } })
    if (!team) return NextResponse.json({ error: `Team "${teamSlug}" not found` }, { status: 422 })
  } else if (developer.teamMembers.length === 1) {
    team = { id: developer.teamMembers[0].teamId }
  }

  // Upsert project by repo slug — tag to team if resolved
  const project = await db.project.upsert({
    where: { projectCode },
    update: { name: projectName, deletedAt: null, ...(team ? { teamId: team.id } : {}) },
    create: { projectCode, name: projectName, teamId: team?.id ?? null },
  })

  // Upsert each rule by code so callers don't need to pre-register rules
  const resolvedItems = await Promise.all(items.map(async item => {
    const rule = await db.violationRule.upsert({
      where: { code: item.ruleCode },
      update: { description: item.description, fineAmount: item.fineAmount, category: item.category, deletedAt: null, ...(team ? { teamId: team.id } : {}) },
      create: { code: item.ruleCode, description: item.description, fineAmount: item.fineAmount, category: item.category, teamId: team?.id ?? null },
    })
    return { ...item, ruleId: rule.id }
  }))

  const fine = computeFine(resolvedItems.map(i => ({
    ruleId: i.ruleId,
    ruleCode: i.ruleCode,
    fineAmount: i.fineAmount,
    multiplier: i.multiplier,
  })))

  const reporter = await db.user.upsert({
    where: { email: 'github-sync@system.local' },
    update: {},
    create: { name: 'GitHub Sync', email: 'github-sync@system.local', permissions: ['ADMIN'] },
  })

  const report = await db.violationReport.create({
    data: {
      teamId: team?.id ?? null,
      developerId: developer.id,
      projectId: project.id,
      prLink,
      reporterId: reporter.id,
      status,
      totalFine: fine.developerTotal,
      items: {
        create: resolvedItems.map(i => ({
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
      action: `GitHub sync — ${status === 'DRAFT' ? 'Created as Draft' : 'Created & Submitted'}`,
      userId: reporter.id,
      reportId: report.id,
    },
  })

  // Auto-generate approver fine for dual-fine rules (e.g. SEL_PULL008)
  const hasDual = resolvedItems.some(i => DUAL_FINE_RULES.has(i.ruleCode))
  if (hasDual && approverGithubUsername) {
    const approverDev = await db.developer.findFirst({
      where: { githubUsername: approverGithubUsername, deletedAt: null },
    })
    if (approverDev) {
      const dualItem = resolvedItems.find(i => DUAL_FINE_RULES.has(i.ruleCode))!
      const approverReport = await db.violationReport.create({
        data: {
          teamId: team?.id ?? null,
          developerId: approverDev.id,
          projectId: project.id,
          prLink,
          reporterId: reporter.id,
          status,
          totalFine: 50,
          items: {
            create: [{
              ruleId: dualItem.ruleId,
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
          action: 'GitHub sync — Auto-generated approver fine (SEL_PULL008)',
          userId: reporter.id,
          reportId: approverReport.id,
        },
      })
    }
  }

  return NextResponse.json({
    id: report.id,
    prLink,
    totalFine: fine.developerTotal,
    developer: { githubUsername, name: developer.name },
    project: { projectCode, name: project.name },
  }, { status: 201 })
}
