import { auth } from '@/auth'


import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/permissions'
import { UsersClient } from './users-client'

export default async function UsersPage() {
  const session = await auth()
  const user = session!.user as any
  if (!isAdmin(user.permissions ?? [])) redirect('/dashboard')

  const [users, developers, teams] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        developer: {
          include: {
            teamMembers: {
              include: { team: { select: { id: true, name: true, slug: true } } },
            },
          },
        },
      },
    }),
    db.developer.findMany({
      where: { active: true, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { teamMembers: { include: { team: { select: { id: true, name: true, slug: true } } } } },
    }),
    db.team.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
  ])

  return <UsersClient users={users} developers={developers} teams={teams} currentUserId={user.id} />
}
