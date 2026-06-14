'use client'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

interface Props {
  permissions: string[]
  hasTeamFinanceRole?: boolean
  hasTeamCaptainRole?: boolean
  user: {
    name?: string | null
    email?: string | null
    permissions?: string[]
    avatarUrl?: string | null
    teams?: { slug: string; roles: string[] }[]
  }
  children: React.ReactNode
}

export function AppShell({ permissions, hasTeamFinanceRole, hasTeamCaptainRole, user, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-950">
      <Sidebar
        permissions={permissions}
        hasTeamFinanceRole={hasTeamFinanceRole}
        hasTeamCaptainRole={hasTeamCaptainRole}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
