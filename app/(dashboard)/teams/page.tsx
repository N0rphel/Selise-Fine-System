import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { TeamsClient } from './teams-client'
import { getUserTeamMemberships, visibleTeamIds } from '@/lib/team-auth'

export default async function TeamsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  const admin = isAdmin(user.permissions ?? [])

  // Non-admins can only view their own teams (CAPTAIN/FINANCE/REPORTER)
  let teamIdFilter: string[] | null = null
  if (!admin) {
    const memberships = await getUserTeamMemberships(user.developerId)
    const myTeamIds = visibleTeamIds(memberships)
    if (myTeamIds.length === 0) redirect('/dashboard')
    teamIdFilter = myTeamIds
  }

  const teams = await db.team.findMany({
    where: { deletedAt: null, ...(teamIdFilter ? { id: { in: teamIdFilter } } : {}) },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { members: true, rules: true } },
      financeAccount: { select: { id: true, accountName: true, bankName: true } },
    },
  })

  return <TeamsClient teams={teams} isAdmin={admin} />
}
