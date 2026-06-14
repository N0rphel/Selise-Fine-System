'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users, BookOpen, Landmark, ChevronRight, X } from 'lucide-react'

interface FinanceAccount { id: string; accountName: string; bankName: string | null }
interface Team {
  id: string; name: string; slug: string; description: string | null
  budgetAmount: number
  _count: { members: number; rules: number }
  financeAccount: FinanceAccount | null
}

export function TeamsClient({ teams: initial, isAdmin = false }: { teams: Team[]; isAdmin?: boolean }) {
  const router = useRouter()
  const [teams, setTeams] = useState(initial)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (!name || !slug) { setError('Name and slug are required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, description: description || undefined, budgetAmount: Number(budgetAmount) || 0 }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setShowCreate(false); setName(''); setSlug(''); setDescription(''); setBudgetAmount('')
      router.refresh()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage teams, members, budgets, and team-specific payment accounts</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Team
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teams.map(team => (
          <button
            key={team.id}
            onClick={() => router.push(`/teams/${team.id}`)}
            className="card p-5 text-left hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">{team.slug}</span>
                </div>
                <h2 className="font-semibold text-gray-900 mt-1.5">{team.name}</h2>
                {team.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{team.description}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 mt-0.5 shrink-0" />
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 border-t border-gray-100 pt-3 mt-3">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />{team._count.members} members
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />{team._count.rules} rules
              </span>
              {team.financeAccount && (
                <span className="flex items-center gap-1.5 text-green-600">
                  <Landmark className="w-3.5 h-3.5" />{team.financeAccount.bankName ?? 'Account'}
                </span>
              )}
            </div>

            {team.budgetAmount > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                Budget: <span className="font-medium text-gray-700">Nu. {team.budgetAmount.toLocaleString()}</span>
              </div>
            )}
          </button>
        ))}

        {teams.length === 0 && (
          <div className="col-span-3 card p-10 text-center text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No teams yet. Create one to get started.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Create Team</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Team Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Backend" />
              </div>
              <div>
                <label className="label">Slug * <span className="text-gray-400 font-normal">(short identifier, e.g. BE)</span></label>
                <input value={slug} onChange={e => setSlug(e.target.value.toUpperCase())} className="input font-mono" placeholder="BE" maxLength={20} />
              </div>
              <div>
                <label className="label">Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Optional description…" />
              </div>
              <div>
                <label className="label">Budget Allocation (Nu.)</label>
                <input type="number" min={0} value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} className="input" placeholder="0" />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={create} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Creating…' : 'Create Team'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
