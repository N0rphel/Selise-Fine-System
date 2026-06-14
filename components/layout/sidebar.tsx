'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, AlertTriangle, FolderOpen, Users, BookOpen, Calendar, BarChart3, UserCog, Landmark, ClipboardList, RotateCcw, ChevronsLeft, ChevronsRight, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { visibleNav } from '@/lib/permissions'
import { MomoIcon } from '@/components/momo-icon'

const ALL_NAV = [
  { href: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/violations',      icon: AlertTriangle,   label: 'Violations' },
  { href: '/projects',        icon: FolderOpen,      label: 'Projects' },
  { href: '/developers',      icon: Users,           label: 'Developers' },
  { href: '/rules',           icon: BookOpen,        label: 'Violation Rules' },
  { href: '/assignments',     icon: Calendar,        label: 'Assignments' },
  { href: '/attendance',      icon: ClipboardList,   label: 'Attendance' },
  { href: '/pr-owner',        icon: RotateCcw,       label: 'PR Captain Rotation' },
  { href: '/reports',         icon: BarChart3,       label: 'Finance Reports' },
  { href: '/teams',           icon: UsersRound,      label: 'Teams' },
  { href: '/users',           icon: UserCog,         label: 'User Management' },
  { href: '/payment-details', icon: Landmark,        label: 'Payment Details' },
]

interface Props {
  permissions: string[]
  hasTeamFinanceRole?: boolean
  hasTeamCaptainRole?: boolean
  mobileOpen: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({ permissions, hasTeamFinanceRole, hasTeamCaptainRole, mobileOpen, onClose, collapsed, onToggleCollapse }: Props) {
  const path = usePathname()
  const allowed = visibleNav(permissions, hasTeamFinanceRole, hasTeamCaptainRole)
  const visible = ALL_NAV.filter(n => allowed.includes(n.href))

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 bg-slate-900 flex flex-col shrink-0',
          'w-60 transition-all duration-200 ease-in-out',
          // mobile: slide in/out
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          // desktop: width animates between collapsed (w-16) and expanded (w-60)
          collapsed ? 'lg:w-16' : 'lg:w-60'
        )}
      >
        {/* Logo header */}
        <div className={cn(
          'h-14 flex items-center gap-2.5 px-4 border-b border-white/10 shrink-0',
          collapsed ? 'lg:justify-center lg:px-0' : 'lg:justify-between'
        )}>
          {/* Logo + brand name — hidden when collapsed on desktop */}
          <div className={cn('flex items-center gap-2.5', collapsed && 'lg:hidden')}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <MomoIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">Fine System</p>
              <p className="text-slate-500 text-xs leading-tight">SELISE</p>
            </div>
          </div>
          {/* Collapse toggle — desktop only, always at top */}
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors shrink-0"
          >
            {collapsed
              ? <ChevronsRight className="w-4 h-4" />
              : <ChevronsLeft className="w-4 h-4" />
            }
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {visible.map(item => {
            const active = path === item.href || path.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'nav-item',
                  collapsed && 'lg:justify-center lg:px-0',
                  active ? 'nav-item-active' : 'nav-item-default'
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Mobile footer */}
        <div className="p-2 border-t border-white/10 lg:hidden">
          <div className="px-3 py-2 flex flex-wrap gap-1">
            {permissions.map(p => (
              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400 font-medium">{p}</span>
            ))}
          </div>
          <p className="text-xs text-slate-600 text-center pb-1">© 2024 SELISE</p>
        </div>

        {/* Bottom attribution */}
        <div className={cn('px-3 py-2 border-t border-white/10 shrink-0', collapsed && 'lg:hidden')}>
          <p className="text-[10px] text-slate-600 text-center">Made by Claude</p>
        </div>
      </aside>
    </>
  )
}
