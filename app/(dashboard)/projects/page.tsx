import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'


import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { ProjectsClient } from './projects-client'

export default async function ProjectsPage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']
  if (!isAdmin(user.permissions ?? [])) redirect('/dashboard')

  const projects = await db.project.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: { _count: { select: { violations: true, assignments: true } } },
  })

  return <ProjectsClient projects={projects} canEdit={true} />
}
