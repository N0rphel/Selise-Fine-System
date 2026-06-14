import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, financeTeamIds } from '@/lib/team-auth'
import { ReportsClient } from './reports-client'

export default async function ReportsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any
  const permissions: string[] = user.permissions ?? []

  const memberships = await getUserTeamMemberships(user.developerId)
  const myFinanceTeams = financeTeamIds(memberships)
  const hasFinanceAccess = isAdmin(permissions) || myFinanceTeams.length > 0

  if (!hasFinanceAccess) redirect('/dashboard')

  const isFinance = isAdmin(permissions) || myFinanceTeams.length > 0

  return <ReportsClient isFinance={isFinance} financeTeamIds={myFinanceTeams} />
}
