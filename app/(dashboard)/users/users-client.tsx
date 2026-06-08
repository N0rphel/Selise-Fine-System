'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Github, User, Edit2 } from 'lucide-react'
import { PERMISSIONS, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS } from '@/lib/permissions'
import { formatDate } from '@/lib/utils'

interface Developer { id: string; name: string; employeeId: string }
interface AppUser {
  id: string; name: string; email: string; permissions: string[]
  githubId: string | null; avatarUrl: string | null; createdAt: Date
  developer: Developer | null
}

const permColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 ring-purple-200',
  FINANCE: 'bg-green-100 text-green-700 ring-green-200',
  DEVELOPER: 'bg-blue-100 text-blue-700 ring-blue-200',
}

export function UsersClient({ users, developers, currentUserId }: { users: AppUser[]; developers: Developer[]; currentUserId: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [selectedDevId, setSelectedDevId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openEdit(u: AppUser) {
    setEditing(u)
    // DEVELOPER is the baseline — always present
    setSelectedPerms(Array.from(new Set(['DEVELOPER', ...u.permissions])))
    setSelectedDevId(u.developer?.id ?? '')
    setError('')
  }

  function togglePerm(p: string) {
    if (p === 'DEVELOPER') return // baseline — every user is always a developer
    setSelectedPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  async function save() {
    if (!editing) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/users/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: selectedPerms, developerId: selectedDevId || null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setEditing(null); router.refresh()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">User Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage user permission sets — a user can hold multiple permissions simultaneously</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">User</th>
              <th className="table-th">Login Method</th>
              <th className="table-th">Permissions</th>
              <th className="table-th">Linked Developer</th>
              <th className="table-th">Joined</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={`table-row ${u.id === currentUserId ? 'bg-blue-50/30' : ''}`}>
                <td className="table-td">
                  <div className="flex items-center gap-2.5">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{u.name} {u.id === currentUserId && <span className="text-xs text-blue-500">(you)</span>}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="table-td">
                  <div className="flex flex-col gap-1">
                    {u.githubId && <span className="flex items-center gap-1 text-xs text-gray-600"><Github className="w-3.5 h-3.5" />GitHub</span>}
                    {!u.githubId && <span className="text-xs text-gray-500">Email/Password</span>}
                  </div>
                </td>
                <td className="table-td">
                  <div className="flex flex-wrap gap-1">
                    {u.permissions.map(p => (
                      <span key={p} className={`badge text-[10px] ${permColors[p] ?? 'bg-gray-100 text-gray-600 ring-gray-200'}`}>{p}</span>
                    ))}
                  </div>
                </td>
                <td className="table-td">
                  {u.developer ? (
                    <div>
                      <p className="text-sm text-gray-800">{u.developer.name}</p>
                      <p className="text-xs text-gray-400">{u.developer.employeeId}</p>
                    </div>
                  ) : <span className="text-gray-400 text-xs">Not linked</span>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div>
              <h2 className="font-semibold text-gray-900">Edit Permissions</h2>
              <p className="text-sm text-gray-500 mt-0.5">{editing.name} · {editing.email}</p>
            </div>

            <div>
              <label className="label mb-2">Permission Set</label>
              <div className="space-y-2">
                {PERMISSIONS.map(p => {
                  const locked = p === 'DEVELOPER'
                  const checked = selectedPerms.includes(p)
                  return (
                    <label key={p}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${locked ? 'cursor-default border-gray-200 bg-gray-50' : checked ? 'cursor-pointer border-blue-500 bg-blue-50' : 'cursor-pointer border-gray-200 hover:bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => togglePerm(p)}
                        className="mt-0.5 accent-blue-600"
                      />
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

            <div>
              <label className="label">Linked Developer Profile</label>
              <select value={selectedDevId} onChange={e => setSelectedDevId(e.target.value)} className="input">
                <option value="">None</option>
                {developers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.employeeId})</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Required for Developer permission to scope violations correctly</p>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3">
              <button onClick={save} disabled={loading || selectedPerms.length === 0} className="btn-primary flex-1">
                {loading ? 'Saving…' : 'Save Permissions'}
              </button>
              <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
