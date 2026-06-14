import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { getUserTeamMemberships, financeTeamIds, captainTeamIds } from '@/lib/team-auth'
import { db } from '@/lib/db'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']

  const memberships = await getUserTeamMemberships(user.developerId)
  const hasTeamFinanceRole = financeTeamIds(memberships).length > 0
  const hasTeamCaptainRole = captainTeamIds(memberships).length > 0

  // Build team chips for the topbar (non-admin users)
  let teams: { slug: string; roles: string[] }[] = []
  if (!permissions.includes('ADMIN') && memberships.length > 0) {
    const teamRows = await db.team.findMany({
      where: { id: { in: memberships.map(m => m.teamId) }, deletedAt: null },
      select: { id: true, slug: true },
    })
    const slugById = Object.fromEntries(teamRows.map(t => [t.id, t.slug]))
    teams = memberships
      .filter(m => slugById[m.teamId])
      .map(m => ({ slug: slugById[m.teamId], roles: m.roles }))
  }

  return (
    <AppShell
      permissions={permissions}
      hasTeamFinanceRole={hasTeamFinanceRole}
      hasTeamCaptainRole={hasTeamCaptainRole}
      user={{ ...user, permissions, teams }}
    >
      {children}
    </AppShell>
  )
}
