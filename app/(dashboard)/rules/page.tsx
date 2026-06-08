import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'


import { db } from '@/lib/db'
import { RulesClient } from './rules-client'

export default async function RulesPage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']

  const rules = await db.violationRule.findMany({
    where: { deletedAt: null },
    orderBy: [{ category: 'asc' }, { code: 'asc' }],
    include: { _count: { select: { items: true } } },
  })

  return <RulesClient rules={rules} isAdmin={isAdmin(user.permissions ?? [])} />
}
