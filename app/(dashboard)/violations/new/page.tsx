import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'


import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { NewViolationForm } from './new-violation-form'

export default async function NewViolationPage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']

  if (!isAdmin(user.permissions ?? [])) redirect('/violations')

  const [developers, projects, rules] = await Promise.all([
    db.developer.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: 'asc' } }),
    db.project.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: 'asc' } }),
    db.violationRule.findMany({ where: { active: true, deletedAt: null }, orderBy: [{ category: 'asc' }, { code: 'asc' }] }),
  ])

  return (
    <NewViolationForm
      developers={developers}
      projects={projects}
      rules={rules}
      reporterId={user.id}
    />
  )
}
