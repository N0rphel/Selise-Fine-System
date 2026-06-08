import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'


import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AssignmentsClient } from './assignments-client'

export default async function AssignmentsPage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']
  if (!isAdmin(user.permissions ?? [])) redirect('/dashboard')

  const cycles = await db.assignmentCycle.findMany({
    orderBy: { startDate: 'desc' },
    include: { _count: { select: { assignments: true } } },
  })

  return <AssignmentsClient cycles={cycles} canManage={true} />
}
