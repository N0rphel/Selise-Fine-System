'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react'
import { formatCHF } from '@/lib/utils'

interface Rule {
  id: string; code: string; category: string; description: string
  fineAmount: number; active: boolean; teamId: string | null
  _count: { items: number }
  team: { name: string; slug: string } | null
}
interface CaptainTeam { id: string; name: string; slug: string }

function CategoryCombobox({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  // Keep query in sync when parent resets form
  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  function select(val: string) {
    onChange(val)
    setQuery(val)
    setOpen(false)
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={onInput}
          onFocus={() => setOpen(true)}
          className="input pr-8"
          placeholder="e.g. Pull Request, Rails…"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(o => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            query ? (
              <li
                className="px-3 py-2 text-sm text-blue-600 cursor-pointer hover:bg-blue-50"
                onMouseDown={() => select(query)}
              >
                Create &ldquo;{query}&rdquo;
              </li>
            ) : null
          ) : (
            <>
              {filtered.map(o => (
                <li
                  key={o}
                  onMouseDown={() => select(o)}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${o === value ? 'font-medium text-blue-600 bg-blue-50' : 'text-gray-700'}`}
                >
                  {o}
                </li>
              ))}
              {query && !options.includes(query) && (
                <li
                  onMouseDown={() => select(query)}
                  className="px-3 py-2 text-sm text-blue-600 cursor-pointer hover:bg-blue-50 border-t border-gray-100"
                >
                  Create &ldquo;{query}&rdquo;
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  )
}

export function RulesClient({
  rules: initial, isAdmin, captainTeams = [],
}: {
  rules: Rule[]
  isAdmin: boolean
  captainTeams?: CaptainTeam[]
}) {
  const router = useRouter()
  const [rules, setRules] = useState(initial)
  useEffect(() => { setRules(initial) }, [initial])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Rule | null>(null)
  const [form, setForm] = useState({ code: '', category: '', description: '', fineAmount: '', teamId: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterTeam, setFilterTeam] = useState<string>('all')

  // Captain can manage rules for their teams; admin can manage all
  const canManage = isAdmin || captainTeams.length > 0
  const captainTeamIds = new Set(captainTeams.map(t => t.id))

  function canEditRule(r: Rule) {
    if (isAdmin) return true
    return !!r.teamId && captainTeamIds.has(r.teamId)
  }

  const teams = useMemo(() => {
    const map = new Map<string, { name: string; slug: string }>()
    rules.forEach(r => { if (r.team) map.set(r.team.slug, r.team) })
    return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug))
  }, [rules])

  // Derive unique categories from existing rules
  const existingCategories = useMemo(() =>
    Array.from(new Set(rules.map(r => r.category))).sort(),
  [rules])

  const filtered = useMemo(() => {
    if (filterTeam === 'all') return rules
    if (filterTeam === 'global') return rules.filter(r => !r.teamId)
    return rules.filter(r => r.team?.slug === filterTeam)
  }, [rules, filterTeam])

  const grouped = useMemo(() => {
    const g: Record<string, Rule[]> = {}
    filtered.forEach(r => { if (!g[r.category]) g[r.category] = []; g[r.category].push(r) })
    return g
  }, [filtered])

  function openCreate() {
    setEditing(null)
    // Pre-select team for captains with one team
    const defaultTeam = !isAdmin && captainTeams.length === 1 ? captainTeams[0].id : ''
    setForm({ code: '', category: '', description: '', fineAmount: '', teamId: defaultTeam })
    setShowModal(true)
  }

  function openEdit(r: Rule) {
    setEditing(r)
    setForm({ code: r.code, category: r.category, description: r.description, fineAmount: String(r.fineAmount), teamId: r.teamId ?? '' })
    setShowModal(true)
  }

  async function save() {
    setLoading(true); setError('')
    try {
      const payload = {
        code: form.code,
        category: form.category,
        description: form.description,
        fineAmount: parseFloat(form.fineAmount),
        teamId: form.teamId || null,
      }
      const res = editing
        ? await fetch(`/api/rules/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); throw new Error(String(d.error)) }
      setShowModal(false); router.refresh()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function toggle(r: Rule) {
    const next = !r.active
    setRules(prev => prev.map(x => x.id === r.id ? { ...x, active: next } : x))
    try {
      const res = await fetch(`/api/rules/${r.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: next }) })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setRules(prev => prev.map(x => x.id === r.id ? { ...x, active: r.active } : x))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Violation Rules</h1>
        {canManage && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        )}
      </div>

      {teams.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[{ slug: 'all', name: 'All' }, { slug: 'global', name: 'Global' }, ...teams].map(t => (
            <button
              key={t.slug}
              onClick={() => setFilterTeam(t.slug)}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${filterTeam === t.slug ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {t.slug === 'all' ? 'All teams' : t.slug === 'global' ? 'Global' : `${t.slug} — ${t.name}`}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([cat, catRules]) => (
          <div key={cat} className="card overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-semibold text-gray-700">{cat}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{catRules.length} rules · Total: {formatCHF(catRules.reduce((s, r) => s + r.fineAmount, 0))}</p>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Code</th>
                  <th className="table-th">Team</th>
                  <th className="table-th">Description</th>
                  <th className="table-th">Fine (Nu.)</th>
                  <th className="table-th">Used</th>
                  <th className="table-th">Status</th>
                  {canManage && <th className="table-th"></th>}
                </tr>
              </thead>
              <tbody>
                {catRules.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-td font-mono text-sm font-medium text-blue-700">{r.code}</td>
                    <td className="table-td">
                      {r.team
                        ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{r.team.slug}</span>
                        : <span className="text-xs text-gray-400">Global</span>}
                    </td>
                    <td className="table-td text-gray-600 text-xs max-w-[280px]">{r.description}</td>
                    <td className="table-td font-semibold text-red-600">{formatCHF(r.fineAmount)}</td>
                    <td className="table-td text-gray-500">{r._count.items}×</td>
                    <td className="table-td">
                      <span className={`badge ${r.active ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                        {r.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="table-td">
                        {canEditRule(r) && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(r)} className="btn-ghost py-1 px-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => toggle(r)} className="btn-ghost py-1 px-1.5">
                              {r.active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <div className="card p-12 text-center text-gray-400 text-sm">No rules found.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="font-semibold text-gray-900">{editing ? 'Edit Rule' : 'Add Rule'}</h2>
            <div>
              <label className="label">Rule Code *</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="input" placeholder="SEL_PULL001" disabled={!!editing} />
            </div>
            <div>
              <label className="label">Category *</label>
              <CategoryCombobox
                value={form.category}
                onChange={v => setForm(f => ({ ...f, category: v }))}
                options={existingCategories}
              />
            </div>
            <div>
              <label className="label">Description *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input resize-none" />
            </div>
            <div>
              <label className="label">Fine Amount (Nu.) *</label>
              <input type="number" min="0" step="1" value={form.fineAmount} onChange={e => setForm(f => ({ ...f, fineAmount: e.target.value }))} className="input" placeholder="20" />
            </div>
            {/* Team selector: admin picks any team or global; captain sees only their teams */}
            <div>
              <label className="label">Team</label>
              {isAdmin ? (
                <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} className="input">
                  <option value="">Global (applies to all teams)</option>
                  {teams.map(t => <option key={t.slug} value={rules.find(r => r.team?.slug === t.slug)?.teamId ?? ''}>{t.name} ({t.slug})</option>)}
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
              <button onClick={save} disabled={loading} className="btn-primary flex-1">{loading ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
