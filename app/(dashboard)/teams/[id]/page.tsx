import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { TeamDetailClient } from './team-detail-client'
import { getUserTeamMemberships, financeTeamIds } from '@/lib/team-auth'

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  const admin = isAdmin(user.permissions ?? [])

  const { id } = await params

  if (!admin) {
    const memberships = await getUserTeamMemberships(user.developerId)
    if (!financeTeamIds(memberships).includes(id)) redirect('/dashboard')
  }

  const [team, developers] = await Promise.all([
    db.team.findFirst({
      where: { id, deletedAt: null },
      include: {
        members: {
          include: { developer: { select: { id: true, name: true, employeeId: true, githubUsername: true, department: true } } },
          orderBy: { createdAt: 'asc' },
        },
        rules: { where: { deletedAt: null }, orderBy: { category: 'asc' } },
        financeAccount: true,
      },
    }),
    admin
      ? db.developer.findMany({
          where: { deletedAt: null, active: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, employeeId: true, githubUsername: true, department: true },
        })
      : [],
  ])

  if (!team) notFound()

  return <TeamDetailClient team={team} allDevelopers={developers} isAdmin={admin} />
}
