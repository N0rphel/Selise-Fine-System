import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, reporterTeamIds } from '@/lib/team-auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { NewViolationForm } from './new-violation-form'

export default async function NewViolationPage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']

  const admin = isAdmin(permissions)
  const memberships = await getUserTeamMemberships(user.developerId)
  const myReporterTeams = reporterTeamIds(memberships)

  if (!admin && !myReporterTeams.length) redirect('/violations')

  const teamIdFilter = admin ? undefined : myReporterTeams

  const [teams, devsWithTeams, projects, rules] = await Promise.all([
    // Teams the reporter can file violations for
    db.team.findMany({
      where: { deletedAt: null, ...(teamIdFilter ? { id: { in: teamIdFilter } } : {}) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    // Developers scoped to those teams
    db.developer.findMany({
      where: {
        active: true, deletedAt: null,
        ...(teamIdFilter ? { teamMembers: { some: { teamId: { in: teamIdFilter } } } } : {}),
      },
      include: { teamMembers: { select: { teamId: true } } },
      orderBy: { name: 'asc' },
    }),
    db.project.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, projectCode: true, teamId: true } }),
    // Rules for those teams
    db.violationRule.findMany({
      where: {
        active: true, deletedAt: null,
        // global rules (teamId null) + team-specific rules
        ...(teamIdFilter ? { OR: [{ teamId: null }, { teamId: { in: teamIdFilter } }] } : {}),
      },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    }),
  ])

  // teamId → developerId[] for client-side filtering
  const teamDeveloperIds: Record<string, string[]> = {}
  devsWithTeams.forEach(d => {
    d.teamMembers.forEach(m => {
      if (!teamDeveloperIds[m.teamId]) teamDeveloperIds[m.teamId] = []
      teamDeveloperIds[m.teamId].push(d.id)
    })
  })

  const developers = devsWithTeams.map(({ teamMembers: _, ...d }) => d)

  return (
    <NewViolationForm
      teams={teams}
      teamDeveloperIds={teamDeveloperIds}
      developers={developers}
      projects={projects}
      rules={rules}
      reporterId={user.id}
    />
  )
}
