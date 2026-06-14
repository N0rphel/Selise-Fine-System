'use client'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { LogOut, User, Menu, Sun, Moon } from 'lucide-react'
import { PERMISSION_LABELS } from '@/lib/permissions'
import { useTheme } from '@/components/theme-provider'

interface TeamBadge { slug: string; roles: string[] }

interface Props {
  user: {
    name?: string | null
    email?: string | null
    permissions?: string[]
    avatarUrl?: string | null
    teams?: TeamBadge[]
  }
  onMenuClick: () => void
}

export function Topbar({ user, onMenuClick }: Props) {
  const { theme, toggle } = useTheme()
  const perms = user.permissions ?? []
  const label = perms.includes('ADMIN')
    ? 'Admin / PR Captain'
    : perms.map(p => PERMISSION_LABELS[p as keyof typeof PERMISSION_LABELS] ?? p).join(', ')

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 shrink-0">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="lg:hidden -ml-1 p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-1 sm:gap-3 ml-auto">
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Team chips for multi-team non-admin users */}
        {!perms.includes('ADMIN') && user.teams && user.teams.length > 0 && (
          <div className="hidden md:flex items-center gap-1">
            {user.teams.map(t => (
              <span key={t.slug} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {t.slug}
                {t.roles.filter(r => r !== 'MEMBER').map(r => (
                  <span key={r} className="ml-0.5 opacity-70">{r[0]}</span>
                ))}
              </span>
            ))}
          </div>
        )}

        {/* Avatar → profile link */}
        <Link href="/profile" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.name ?? ''} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 bg-blue-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600 dark:text-slate-400" />
            </div>
          )}
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 leading-tight">{user.name}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-tight">{label}</p>
          </div>
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Sign out</span>
        </button>
      </div>
    </header>
  )
}
