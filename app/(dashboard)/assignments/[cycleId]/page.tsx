import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds, getTeamDeveloperIds } from '@/lib/team-auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { CycleDetailClient } from './cycle-detail-client'

export default async function CycleDetailPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']
  const { cycleId } = await params

  const admin = isAdmin(permissions)
  const memberships = await getUserTeamMemberships(user.developerId)
  const myCaptainTeams = admin ? [] : captainTeamIds(memberships)

  const [cycle, allCycles] = await Promise.all([
    db.assignmentCycle.findUnique({
      where: { id: cycleId },
      include: {
        assignments: {
          include: { project: true, developer: true },
          orderBy: [{ project: { name: 'asc' } }, { developer: { name: 'asc' } }],
        },
        team: { select: { id: true, name: true, slug: true } },
      },
    }),
    db.assignmentCycle.findMany({ orderBy: { startDate: 'desc' }, select: { id: true, name: true } }),
  ])

  if (!cycle) notFound()

  // CAPTAIN can manage only if this cycle belongs to their team
  const canManage = admin || (!!cycle.teamId && myCaptainTeams.includes(cycle.teamId))

  // Filter developers to team members when cycle is team-scoped
  let developerIds: string[] | null = null
  if (cycle.teamId) developerIds = await getTeamDeveloperIds([cycle.teamId])

  const [developers, projects] = await Promise.all([
    db.developer.findMany({
      where: {
        active: true, deletedAt: null,
        ...(developerIds ? { id: { in: developerIds } } : {}),
      },
      select: { id: true, name: true, department: true, githubUsername: true },
      orderBy: { name: 'asc' },
    }),
    db.project.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: 'asc' } }),
  ])

  return (
    <CycleDetailClient
      cycle={cycle}
      developers={developers}
      projects={projects}
      allCycles={allCycles}
      canManage={canManage}
    />
  )
}
