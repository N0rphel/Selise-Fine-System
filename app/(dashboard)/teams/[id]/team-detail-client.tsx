'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Shield, User, BookOpen, Crown, Landmark, X, Save } from 'lucide-react'

interface Developer { id: string; name: string; employeeId: string; githubUsername: string | null; department: string }
interface TeamMember { id: string; roles: string[]; developer: Developer }
interface Rule { id: string; code: string; category: string; description: string; fineAmount: number }
interface FinanceAccount { id: string; accountName: string; accountNumber: string; bankName: string | null; notes: string | null; qrCodeBase64: string | null }
interface Team {
  id: string; name: string; slug: string; description: string | null; budgetAmount: number
  members: TeamMember[]; rules: Rule[]; financeAccount: FinanceAccount | null
}

const roleColors: Record<string, string> = {
  CAPTAIN:  'bg-purple-100 text-purple-700',
  REPORTER: 'bg-orange-100 text-orange-700',
  FINANCE:  'bg-green-100 text-green-700',
  MEMBER:   'bg-blue-100 text-blue-700',
}

type Tab = 'members' | 'rules' | 'finance' | 'settings'

export function TeamDetailClient({
  team: initial,
  allDevelopers,
  isAdmin,
}: {
  team: Team
  allDevelopers: Developer[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [team, setTeam] = useState(initial)
  const [tab, setTab] = useState<Tab>(isAdmin ? 'members' : 'finance')

  // Add member
  const TEAM_ROLES = ['MEMBER', 'REPORTER', 'CAPTAIN', 'FINANCE'] as const
  const [showAdd, setShowAdd] = useState(false)
  const [addDevId, setAddDevId] = useState('')
  const [addRoles, setAddRoles] = useState<string[]>(['MEMBER'])
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  // Settings
  const [editName, setEditName] = useState(team.name)
  const [editDesc, setEditDesc] = useState(team.description ?? '')
  const [editBudget, setEditBudget] = useState(String(team.budgetAmount))
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  // Finance account
  const [faName, setFaName] = useState(team.financeAccount?.accountName ?? '')
  const [faNumber, setFaNumber] = useState(team.financeAccount?.accountNumber ?? '')
  const [faBank, setFaBank] = useState(team.financeAccount?.bankName ?? '')
  const [faNotes, setFaNotes] = useState(team.financeAccount?.notes ?? '')
  const [faQr, setFaQr] = useState(team.financeAccount?.qrCodeBase64 ?? '')
  const [faSaving, setFaSaving] = useState(false)
  const [faError, setFaError] = useState('')
  const [faSuccess, setFaSuccess] = useState(false)

  const memberIds = new Set(team.members.map(m => m.developer.id))
  const nonMembers = allDevelopers.filter(d => !memberIds.has(d.id))

  function toggleAddRole(role: string) {
    setAddRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
  }

  async function addMember() {
    if (!addDevId) { setAddError('Select a developer'); return }
    if (!addRoles.length) { setAddError('Select at least one role'); return }
    setAddLoading(true); setAddError('')
    try {
      const res = await fetch(`/api/teams/${team.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developerId: addDevId, roles: addRoles }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      const newMember = await res.json()
      setTeam(t => ({ ...t, members: [...t.members, newMember] }))
      setShowAdd(false); setAddDevId(''); setAddRoles(['MEMBER'])
    } catch (e: any) { setAddError(e.message) } finally { setAddLoading(false) }
  }

  async function removeMember(developerId: string) {
    const res = await fetch(`/api/teams/${team.id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ developerId }),
    })
    if (res.ok) setTeam(t => ({ ...t, members: t.members.filter(m => m.developer.id !== developerId) }))
  }

  async function saveSettings() {
    setSettingsSaving(true); setSettingsError('')
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDesc || undefined, budgetAmount: Number(editBudget) || 0 }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      const updated = await res.json()
      setTeam(t => ({ ...t, name: updated.name, description: updated.description, budgetAmount: updated.budgetAmount }))
    } catch (e: any) { setSettingsError(e.message) } finally { setSettingsSaving(false) }
  }

  async function saveFinanceAccount() {
    if (!faName || !faNumber) { setFaError('Account name and number are required'); return }
    setFaSaving(true); setFaError(''); setFaSuccess(false)
    try {
      const res = await fetch(`/api/teams/${team.id}/finance-account`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName:  faName,
          accountNumber: faNumber,
          bankName:     faBank  || null,
          notes:        faNotes || null,
          qrCodeBase64: faQr    || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      const account = await res.json()
      setTeam(t => ({ ...t, financeAccount: account }))
      setFaSuccess(true)
    } catch (e: any) { setFaError(e.message) } finally { setFaSaving(false) }
  }

  function handleQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setFaQr(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function deleteTeam() {
    if (!confirm(`Delete team "${team.name}"? Members and rules will be unlinked.`)) return
    await fetch(`/api/teams/${team.id}`, { method: 'DELETE' })
    router.push('/teams')
  }

  const tabs: { key: Tab; label: string; adminOnly: boolean }[] = [
    { key: 'members',  label: 'Members',         adminOnly: true },
    { key: 'rules',    label: 'Rules',            adminOnly: true },
    { key: 'finance',  label: 'Finance Account',  adminOnly: false },
    { key: 'settings', label: 'Settings',         adminOnly: true },
  ]
  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin)

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/teams')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">{team.slug}</span>
            <h1 className="page-title">{team.name}</h1>
          </div>
          {team.description && <p className="text-sm text-gray-500 mt-0.5">{team.description}</p>}
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Members</p>
            <p className="text-2xl font-bold text-gray-900">{team.members.length}</p>
            <p className="text-xs text-purple-600 mt-0.5">
              {team.members.filter(m => m.roles.includes('CAPTAIN')).length} captain(s) · {team.members.filter(m => m.roles.includes('REPORTER')).length} reporter(s)
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Team Rules</p>
            <p className="text-2xl font-bold text-gray-900">{team.rules.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-1">Budget Allocation</p>
            <p className="text-2xl font-bold text-gray-900">
              {team.budgetAmount > 0 ? `Nu. ${team.budgetAmount.toLocaleString()}` : '—'}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {visibleTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === 'members' && isAdmin && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Member
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Developer</th>
                  <th className="table-th">Department</th>
                  <th className="table-th">GitHub</th>
                  <th className="table-th">Role</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {team.members.length === 0 && (
                  <tr><td colSpan={5} className="table-td text-center text-gray-400 py-8">No members yet</td></tr>
                )}
                {team.members.map(m => (
                  <tr key={m.id} className="table-row">
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                          {m.roles.includes('CAPTAIN')
                            ? <Crown className="w-3.5 h-3.5 text-purple-500" />
                            : m.roles.includes('REPORTER')
                            ? <Shield className="w-3.5 h-3.5 text-orange-500" />
                            : <User className="w-3.5 h-3.5 text-gray-500" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{m.developer.name}</p>
                          <p className="text-xs text-gray-400">{m.developer.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td text-sm text-gray-600">{m.developer.department}</td>
                    <td className="table-td text-sm text-gray-500">{m.developer.githubUsername ?? '—'}</td>
                    <td className="table-td">
                      <div className="flex flex-wrap gap-1">
                        {m.roles.map(role => (
                          <span key={role} className={`badge ${roleColors[role] ?? 'bg-gray-100 text-gray-700'}`}>{role}</span>
                        ))}
                      </div>
                    </td>
                    <td className="table-td">
                      <button onClick={() => removeMember(m.developer.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showAdd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Add Member</h2>
                  <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="label">Developer *</label>
                    <select value={addDevId} onChange={e => setAddDevId(e.target.value)} className="input">
                      <option value="">Select developer…</option>
                      {nonMembers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.employeeId})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Roles</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {TEAM_ROLES.map(role => {
                        const active = addRoles.includes(role)
                        return (
                          <label key={role}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all ${active ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                            <input type="checkbox" checked={active} onChange={() => toggleAddRole(role)} className="hidden" />
                            {role}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
                {addError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>}
                <div className="flex gap-3">
                  <button onClick={addMember} disabled={addLoading} className="btn-primary flex-1">
                    {addLoading ? 'Adding…' : 'Add'}
                  </button>
                  <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rules tab */}
      {tab === 'rules' && isAdmin && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
            Team-specific rules. Global rules (teamId = null) apply to all teams and are managed from Violation Rules.
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-th">Code</th>
                <th className="table-th">Category</th>
                <th className="table-th">Description</th>
                <th className="table-th text-right">Fine (Nu.)</th>
              </tr>
            </thead>
            <tbody>
              {team.rules.length === 0 && (
                <tr><td colSpan={4} className="table-td text-center text-gray-400 py-8">
                  <BookOpen className="w-6 h-6 mx-auto mb-1 opacity-40" />
                  No team-specific rules yet.
                </td></tr>
              )}
              {team.rules.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="table-td font-mono text-xs text-blue-700">{r.code}</td>
                  <td className="table-td"><span className="badge bg-gray-100 text-gray-600">{r.category}</span></td>
                  <td className="table-td text-sm text-gray-700">{r.description}</td>
                  <td className="table-td text-right font-medium text-red-600">{r.fineAmount > 0 ? `Nu. ${r.fineAmount}` : 'Advisory'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Finance Account tab */}
      {tab === 'finance' && (
        <div className="max-w-lg space-y-5">
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-900">Team Finance Account</h2>
            </div>
            <p className="text-sm text-gray-500">
              Developers will see this account on the Payment Details page when paying their fines.
            </p>

            <div>
              <label className="label">Account Name *</label>
              <input value={faName} onChange={e => setFaName(e.target.value)} className="input" placeholder="e.g. SELISE Backend Team" />
            </div>
            <div>
              <label className="label">Account Number *</label>
              <input value={faNumber} onChange={e => setFaNumber(e.target.value)} className="input" placeholder="Bank account number" />
            </div>
            <div>
              <label className="label">Bank Name</label>
              <input value={faBank} onChange={e => setFaBank(e.target.value)} className="input" placeholder="e.g. BOB, BNB…" />
            </div>
            <div>
              <label className="label">Notes</label>
              <input value={faNotes} onChange={e => setFaNotes(e.target.value)} className="input" placeholder="Payment instructions…" />
            </div>
            <div>
              <label className="label">QR Code</label>
              {faQr && (
                <div className="mb-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={faQr} alt="QR" className="w-24 h-24 border rounded-lg object-contain p-1" />
                  <button onClick={() => setFaQr('')} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleQrUpload} className="text-sm text-gray-600" />
            </div>

            {faError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{faError}</p>}
            {faSuccess && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Saved successfully.</p>}

            <button onClick={saveFinanceAccount} disabled={faSaving} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" />
              {faSaving ? 'Saving…' : 'Save Account Details'}
            </button>
          </div>
        </div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && isAdmin && (
        <div className="space-y-5 max-w-lg">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Team Settings</h2>
            <div>
              <label className="label">Team Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Description</label>
              <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="input" placeholder="Optional…" />
            </div>
            <div>
              <label className="label">Budget Allocation (Nu.)</label>
              <input type="number" min={0} value={editBudget} onChange={e => setEditBudget(e.target.value)} className="input" />
            </div>
            {settingsError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{settingsError}</p>}
            <button onClick={saveSettings} disabled={settingsSaving} className="btn-primary">
              {settingsSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          <div className="card p-5 border border-red-100">
            <h2 className="font-semibold text-red-700 mb-1">Danger Zone</h2>
            <p className="text-sm text-gray-500 mb-3">Deleting a team soft-deletes it. Existing violations are not affected.</p>
            <button onClick={deleteTeam} className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              Delete Team
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
