'use client'
import { useState } from 'react'
import { Github, User, Edit2, X, Check } from 'lucide-react'
import { PERMISSIONS, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'

interface TeamMember {
  teamId: string; roles: string[]
  team: { id: string; name: string; slug: string }
}
interface Developer {
  id: string; name: string; employeeId: string
  teamMembers: TeamMember[]
}
interface Team { id: string; name: string; slug: string }
interface AppUser {
  id: string; name: string; email: string; permissions: string[]
  githubId: string | null; avatarUrl: string | null; createdAt: Date
  developer: Developer | null
}

const TEAM_ROLES = ['MEMBER', 'REPORTER', 'CAPTAIN', 'FINANCE'] as const
type TeamRole = typeof TEAM_ROLES[number]

const permColors: Record<string, string> = {
  ADMIN:     'bg-purple-100 text-purple-700 ring-purple-200',
  FINANCE:   'bg-green-100 text-green-700 ring-green-200',
  DEVELOPER: 'bg-blue-100 text-blue-700 ring-blue-200',
}
const roleColors: Record<string, string> = {
  CAPTAIN:  'bg-purple-100 text-purple-700',
  REPORTER: 'bg-orange-100 text-orange-700',
  FINANCE:  'bg-green-100 text-green-700',
  MEMBER:   'bg-gray-100 text-gray-600',
}
const roleDesc: Record<TeamRole, string> = {
  CAPTAIN:  'Report, approve/reject, manage team',
  REPORTER: 'Report violations for team members',
  FINANCE:  'View team finance reports & payments',
  MEMBER:   'View own violations only',
}

interface TeamAssignment { teamId: string; roles: TeamRole[] }

export function UsersClient({
  users: initial, developers, teams, currentUserId,
}: {
  users: AppUser[]
  developers: Developer[]
  teams: Team[]
  currentUserId: string
}) {
  const [users, setUsers] = useState(initial)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [selectedDevId, setSelectedDevId] = useState('')
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openEdit(u: AppUser) {
    setEditing(u)
    setSelectedPerms(Array.from(new Set(['DEVELOPER', ...u.permissions])))
    setSelectedDevId(u.developer?.id ?? '')
    setTeamAssignments(
      u.developer?.teamMembers.map(m => ({ teamId: m.teamId, roles: m.roles as TeamRole[] })) ?? []
    )
    setError('')
  }

  function togglePerm(p: string) {
    if (p === 'DEVELOPER') return
    setSelectedPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function handleDevChange(devId: string) {
    setSelectedDevId(devId)
    const dev = developers.find(d => d.id === devId)
    setTeamAssignments(dev?.teamMembers.map(m => ({ teamId: m.teamId, roles: m.roles as TeamRole[] })) ?? [])
  }

  function addTeam(teamId: string) {
    if (!teamId || teamAssignments.some(a => a.teamId === teamId)) return
    setTeamAssignments(prev => [...prev, { teamId, roles: ['MEMBER'] }])
  }

  function removeTeam(teamId: string) {
    setTeamAssignments(prev => prev.filter(a => a.teamId !== teamId))
  }

  function toggleTeamRole(teamId: string, role: TeamRole) {
    setTeamAssignments(prev => prev.map(a => {
      if (a.teamId !== teamId) return a
      const roles = a.roles.includes(role)
        ? a.roles.filter(r => r !== role)
        : [...a.roles, role]
      return { ...a, roles: roles.length ? roles : ['MEMBER'] }
    }))
  }

  async function save() {
    if (!editing) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/users/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions:     selectedPerms,
          developerId:     selectedDevId || null,
          teamAssignments,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      // Update local state immediately without full page refresh
      setUsers(prev => prev.map(u => u.id === editing.id ? { ...u, ...data } : u))
      setEditing(null)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const assignedTeamIds = new Set(teamAssignments.map(a => a.teamId))
  const availableTeams = teams.filter(t => !assignedTeamIds.has(t.id))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">User Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage permissions and team memberships. Team roles (Captain, Reporter, Finance) are assigned per team.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">User</th>
              <th className="table-th">Login</th>
              <th className="table-th">Permissions</th>
              <th className="table-th">Teams</th>
              <th className="table-th">Joined</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={`table-row ${u.id === currentUserId ? 'bg-blue-50/30' : ''}`}>
                <td className="table-td">
                  <div className="flex items-center gap-2.5">
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-gray-400" /></div>
                    }
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{u.name} {u.id === currentUserId && <span className="text-xs text-blue-500">(you)</span>}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="table-td">
                  {u.githubId
                    ? <span className="flex items-center gap-1 text-xs text-gray-600"><Github className="w-3.5 h-3.5" />GitHub</span>
                    : <span className="text-xs text-gray-500">Email</span>}
                </td>
                <td className="table-td">
                  <div className="flex flex-wrap gap-1">
                    {u.permissions.map(p => (
                      <span key={p} className={`badge text-[10px] ${permColors[p] ?? 'bg-gray-100 text-gray-600'}`}>{p}</span>
                    ))}
                  </div>
                </td>
                <td className="table-td">
                  <div className="flex flex-wrap gap-1">
                    {u.developer?.teamMembers.map(m => (
                      <span key={m.teamId} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {m.team.slug}
                        {m.roles.filter(r => r !== 'MEMBER').map(r => (
                          <span key={r} className="ml-0.5 opacity-60">{r[0]}</span>
                        ))}
                      </span>
                    ))}
                    {!u.developer?.teamMembers.length && <span className="text-gray-400 text-xs">—</span>}
                  </div>
                </td>
                <td className="table-td text-gray-500">{formatDate(u.createdAt)}</td>
                <td className="table-td">
                  <button onClick={() => openEdit(u)} className="btn-ghost py-1 px-1.5">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5 my-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Edit User</h2>
                <p className="text-sm text-gray-500">{editing.name} · {editing.email}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* System permissions */}
            <div>
              <label className="label mb-2">System Permissions</label>
              <div className="space-y-2">
                {PERMISSIONS.map(p => {
                  const locked = p === 'DEVELOPER'
                  const checked = selectedPerms.includes(p)
                  return (
                    <label key={p}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${locked ? 'cursor-default border-gray-200 bg-gray-50' : checked ? 'cursor-pointer border-blue-500 bg-blue-50' : 'cursor-pointer border-gray-200 hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={checked} disabled={locked} onChange={() => togglePerm(p)} className="mt-0.5 accent-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          {PERMISSION_LABELS[p]}
                          {locked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-medium">Always on</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{PERMISSION_DESCRIPTIONS[p]}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Developer link */}
            <div>
              <label className="label">Linked Developer Profile</label>
              <select value={selectedDevId} onChange={e => handleDevChange(e.target.value)} className="input">
                <option value="">None</option>
                {developers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.employeeId})</option>)}
              </select>
            </div>

            {/* Team assignments */}
            <div>
              <label className="label mb-2">Team Assignments</label>

              {!selectedDevId && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                  Link a developer profile first to assign teams.
                </p>
              )}

              {teamAssignments.length === 0 && selectedDevId && (
                <p className="text-xs text-gray-400 mb-2">No team assignments yet. Select a team below to add.</p>
              )}

              <div className="space-y-2 mb-3">
                {teamAssignments.map(a => {
                  const team = teams.find(t => t.id === a.teamId)
                  if (!team) return null
                  return (
                    <div key={a.teamId} className="border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-800">
                          <span className="text-xs font-bold mr-1.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{team.slug}</span>
                          {team.name}
                        </span>
                        <button onClick={() => removeTeam(a.teamId)} className="text-gray-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {TEAM_ROLES.map(role => {
                          const active = a.roles.includes(role)
                          return (
                            <label key={role}
                              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${active ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                              <input type="checkbox" checked={active} onChange={() => toggleTeamRole(a.teamId, role)} className="hidden" />
                              {active && <Check className="w-3 h-3" />}
                              {role}
                            </label>
                          )
                        })}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">
                        {a.roles.map(r => roleDesc[r as TeamRole]).filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Auto-add: selecting from dropdown immediately adds the team */}
              {selectedDevId && availableTeams.length > 0 && (
                <select
                  value=""
                  onChange={e => { if (e.target.value) addTeam(e.target.value) }}
                  className="input text-sm text-gray-500"
                >
                  <option value="">+ Add to team…</option>
                  {availableTeams.map(t => (
                    <option key={t.id} value={t.id}>{t.slug} — {t.name}</option>
                  ))}
                </select>
              )}

              {selectedDevId && availableTeams.length === 0 && teamAssignments.length > 0 && (
                <p className="text-xs text-gray-400">All teams assigned.</p>
              )}
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3">
              <button onClick={save} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
