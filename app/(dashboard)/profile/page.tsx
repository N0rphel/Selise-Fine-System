import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { isAdmin, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS } from '@/lib/permissions'
import { Github, Shield, Crown, Users, Landmark, User, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const roleIcons: Record<string, typeof Crown> = {
  CAPTAIN:  Crown,
  REPORTER: Shield,
  FINANCE:  Landmark,
  MEMBER:   Users,
}
const roleColors: Record<string, string> = {
  CAPTAIN:  'text-purple-600 bg-purple-50 border-purple-200',
  REPORTER: 'text-orange-600 bg-orange-50 border-orange-200',
  FINANCE:  'text-green-600 bg-green-50 border-green-200',
  MEMBER:   'text-gray-500 bg-gray-50 border-gray-200',
}
const roleDesc: Record<string, string> = {
  CAPTAIN:  'Can report violations, approve/reject, manage team members',
  REPORTER: 'Can report violations for team members',
  FINANCE:  'Can view team finance reports and manage payment account',
  MEMBER:   'Can view own violations',
}

export default async function ProfilePage() {
  const session = await auth()
  if (!session) redirect('/login')
  const u = session.user as any

  const [dbUser, memberships] = await Promise.all([
    db.user.findUnique({
      where: { id: u.id },
      include: {
        developer: {
          select: { id: true, employeeId: true, githubUsername: true, department: true, name: true },
        },
      },
    }),
    db.teamMember.findMany({
      where: { developer: { user: { id: u.id } } },
      include: { team: { select: { id: true, name: true, slug: true, description: true, budgetAmount: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (!dbUser) redirect('/login')

  const permissions: string[] = dbUser.permissions
  const admin = isAdmin(permissions)

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="page-title">My Profile</h1>

      {/* Identity card */}
      <div className="card p-6 flex items-start gap-5">
        {dbUser.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dbUser.avatarUrl} alt={dbUser.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <User className="w-8 h-8 text-blue-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-gray-900">{dbUser.name}</h2>
          <p className="text-sm text-gray-500">{dbUser.email}</p>
          {dbUser.developer?.githubUsername && (
            <a
              href={`https://github.com/${dbUser.developer.githubUsername}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mt-1"
            >
              <Github className="w-4 h-4" />
              @{dbUser.developer.githubUsername}
            </a>
          )}
          {dbUser.developer && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{dbUser.developer.employeeId}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{dbUser.developer.department}</span>
            </div>
          )}
        </div>
      </div>

      {/* System permissions */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">System Access</h2>
        {permissions.map(p => {
          const label = PERMISSION_LABELS[p as keyof typeof PERMISSION_LABELS] ?? p
          const desc  = PERMISSION_DESCRIPTIONS[p as keyof typeof PERMISSION_DESCRIPTIONS] ?? ''
          const color = p === 'ADMIN' ? 'border-purple-200 bg-purple-50'
                      : p === 'FINANCE' ? 'border-green-200 bg-green-50'
                      : 'border-blue-200 bg-blue-50'
          return (
            <div key={p} className={`flex items-start gap-3 rounded-xl border p-3 ${color}`}>
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Team memberships */}
      {memberships.length > 0 ? (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900">Team Memberships</h2>
          {memberships.map(m => {
            const roles: string[] = m.roles
            return (
              <div key={m.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">{m.team.slug}</span>
                      <h3 className="font-semibold text-gray-900">{m.team.name}</h3>
                    </div>
                    {m.team.description && <p className="text-sm text-gray-500 mt-0.5">{m.team.description}</p>}
                  </div>
                  {(admin || roles.includes('CAPTAIN') || roles.includes('FINANCE')) && (
                    <Link href={`/teams/${m.team.id}`} className="text-xs text-blue-600 hover:underline shrink-0">
                      Manage →
                    </Link>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {roles.map(role => {
                    const Icon = roleIcons[role] ?? Users
                    return (
                      <div key={role} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${roleColors[role] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {role}
                      </div>
                    )
                  })}
                </div>

                {/* What you can do in this team */}
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                  {roles.map(role => (
                    <p key={role} className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                      {roleDesc[role] ?? role}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        !admin && (
          <div className="card p-6 text-center text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">You are not assigned to any team yet.</p>
            <p className="text-xs mt-1">Ask your admin to assign you to a team.</p>
          </div>
        )
      )}

      {admin && (
        <div className="card p-4 bg-purple-50 border border-purple-200">
          <p className="text-sm text-purple-700 font-medium">System Admin</p>
          <p className="text-xs text-purple-600 mt-0.5">System-wide access to all teams, users, violations, and reports.</p>
        </div>
      )}
    </div>
  )
}
