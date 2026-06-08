import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']

  return (
    <AppShell permissions={permissions} user={{ ...user, permissions }}>
      {children}
    </AppShell>
  )
}
