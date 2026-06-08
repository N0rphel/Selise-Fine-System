import { auth } from '@/auth'


import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/permissions'
import { UsersClient } from './users-client'

export default async function UsersPage() {
  const session = await auth()
  const user = session!.user as any
  if (!isAdmin(user.permissions ?? [])) redirect('/dashboard')

  const [users, developers] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: 'asc' }, include: { developer: true } }),
    db.developer.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: 'asc' } }),
  ])

  return <UsersClient users={users} developers={developers} currentUserId={user.id} />
}
