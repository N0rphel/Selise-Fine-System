'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, AlertTriangle, FolderOpen, Users, BookOpen, Calendar, BarChart3, UserCog, Landmark, ClipboardList } from 'lucide-react'
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
  { href: '/reports',         icon: BarChart3,       label: 'Finance Reports' },
  { href: '/users',           icon: UserCog,         label: 'User Management' },
  { href: '/payment-details', icon: Landmark,        label: 'Payment Details' },
]

interface Props {
  permissions: string[]
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ permissions, mobileOpen, onClose }: Props) {
  const path = usePathname()
  const allowed = visibleNav(permissions)
  const visible = ALL_NAV.filter(n => allowed.includes(n.href))

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={cn(
          // mobile drawer = wide (labels); desktop = icon-only rail (w-16)
          'fixed lg:static inset-y-0 left-0 z-40 w-60 lg:w-16 bg-slate-900 flex flex-col shrink-0',
          'transform transition-transform duration-200 ease-in-out lg:transform-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo header — aligns with the 56px topbar */}
        <div className="h-14 flex items-center gap-2.5 px-4 lg:px-0 lg:justify-center border-b border-white/10 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <MomoIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 lg:hidden">
            <p className="text-white font-semibold text-sm leading-tight">Fine System</p>
            <p className="text-slate-500 text-xs leading-tight">SELISE</p>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {visible.map(item => {
            const active = path === item.href || path.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={item.label}
                className={cn(
                  'nav-item lg:justify-center lg:px-0',
                  active ? 'nav-item-active' : 'nav-item-default'
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="lg:hidden">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-2 border-t border-white/10">
          <div className="px-3 py-2 flex flex-wrap gap-1 lg:hidden">
            {permissions.map(p => (
              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400 font-medium">{p}</span>
            ))}
          </div>
          <p className="text-xs text-slate-600 text-center pb-1 lg:hidden">© 2024 SELISE</p>
        </div>
      </aside>
    </>
  )
}
