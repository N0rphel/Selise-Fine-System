import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'


import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { CycleDetailClient } from './cycle-detail-client'

export default async function CycleDetailPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']
  const { cycleId } = await params

  const [cycle, developers, projects, allCycles] = await Promise.all([
    db.assignmentCycle.findUnique({
      where: { id: cycleId },
      include: {
        assignments: {
          include: { project: true, developer: true },
          orderBy: [{ project: { name: 'asc' } }, { developer: { name: 'asc' } }],
        },
      },
    }),
    db.developer.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: 'asc' } }),
    db.project.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: 'asc' } }),
    db.assignmentCycle.findMany({ orderBy: { startDate: 'desc' }, select: { id: true, name: true } }),
  ])

  if (!cycle) notFound()

  return (
    <CycleDetailClient
      cycle={cycle}
      developers={developers}
      projects={projects}
      allCycles={allCycles}
      canManage={isAdmin(user.permissions ?? [])}
    />
  )
}
