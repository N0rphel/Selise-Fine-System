import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { ProjectsClient } from './projects-client'

export default async function ProjectsPage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? []
  const admin = isAdmin(permissions)

  const memberships = await getUserTeamMemberships(user.developerId)
  const myCaptainTeams = admin ? [] : captainTeamIds(memberships)

  if (!admin && myCaptainTeams.length === 0) redirect('/dashboard')

  const where: any = { deletedAt: null }
  if (!admin) where.teamId = { in: myCaptainTeams }

  const [projects, captainTeams] = await Promise.all([
    db.project.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { violations: true, assignments: true } },
        team: { select: { id: true, name: true, slug: true } },
      },
    }),
    myCaptainTeams.length > 0
      ? db.team.findMany({ where: { id: { in: myCaptainTeams }, deletedAt: null }, select: { id: true, name: true, slug: true } })
      : [],
  ])

  return <ProjectsClient projects={projects} canEdit isAdmin={admin} captainTeams={captainTeams} />
}
