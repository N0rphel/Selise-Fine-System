import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'


import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { DevelopersClient } from './developers-client'

export default async function DevelopersPage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']
  if (!isAdmin(user.permissions ?? [])) redirect('/dashboard')

  const developers = await db.developer.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { violations: true, assignments: true } },
    },
  })

  return <DevelopersClient developers={developers} canEdit={true} />
}
