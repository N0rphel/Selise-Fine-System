'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Calendar, ChevronRight } from 'lucide-react'
import { formatDate, CYCLE_STATUS_COLORS } from '@/lib/utils'

interface Cycle {
  id: string; name: string; startDate: Date; endDate: Date; status: string
  _count: { assignments: number }
  team: { id: string; name: string; slug: string } | null
}
interface CaptainTeam { id: string; name: string; slug: string }

export function AssignmentsClient({
  cycles, canManage, isAdmin, captainTeams = [],
}: {
  cycles: Cycle[]
  canManage: boolean
  isAdmin: boolean
  captainTeams?: CaptainTeam[]
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    name: '', startDate: '', endDate: '',
    teamId: !isAdmin && captainTeams.length === 1 ? captainTeams[0].id : '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterTeam, setFilterTeam] = useState<string>('all')

  // Unique teams across all cycles for tabs
  const teams = useMemo(() => {
    const map = new Map<string, { id: string; name: string; slug: string }>()
    cycles.forEach(c => { if (c.team) map.set(c.team.id, c.team) })
    return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug))
  }, [cycles])

  const filtered = useMemo(() => {
    if (filterTeam === 'all') return cycles
    return cycles.filter(c => c.team?.id === filterTeam)
  }, [cycles, filterTeam])

  async function createCycle() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/assignments/cycles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(String(d.error)) }
      const cycle = await res.json()
      setShowModal(false)
      router.push(`/assignments/${cycle.id}`)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">PR Master Assignments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage reviewer assignment cycles</p>
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />New Cycle
          </button>
        )}
      </div>

      {/* Team tabs */}
      {teams.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterTeam('all')}
            className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${filterTeam === 'all' ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All teams
          </button>
          {teams.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTeam(t.id)}
              className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${filterTeam === t.id ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <span className="font-bold text-xs mr-1">{t.slug}</span>{t.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No assignment cycles yet.</p>
            {canManage && <button onClick={() => setShowModal(true)} className="btn-primary mt-4">Create First Cycle</button>}
          </div>
        ) : filtered.map(c => (
          <Link key={c.id} href={`/assignments/${c.id}`}
            className="card p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  {c.team && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{c.team.slug}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDate(c.startDate)} — {formatDate(c.endDate)} · {c._count.assignments} assignments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge ${CYCLE_STATUS_COLORS[c.status]}`}>{c.status}</span>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </div>
          </Link>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="font-semibold text-gray-900">New Assignment Cycle</h2>
            <div>
              <label className="label">Cycle Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="Jun-Jul 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start Date *</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">End Date *</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="input" />
              </div>
            </div>
            {/* Team selector */}
            <div>
              <label className="label">Team</label>
              {isAdmin ? (
                <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} className="input">
                  <option value="">Global (all teams)</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
                </select>
              ) : captainTeams.length === 1 ? (
                <input value={`${captainTeams[0].name} (${captainTeams[0].slug})`} className="input bg-gray-50" disabled />
              ) : (
                <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} className="input">
                  <option value="">Select team…</option>
                  {captainTeams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
                </select>
              )}
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={createCycle} disabled={loading} className="btn-primary flex-1">{loading ? 'Creating…' : 'Create Cycle'}</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
