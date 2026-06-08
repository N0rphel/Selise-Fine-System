'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import { formatCHF } from '@/lib/utils'

interface Rule {
  id: string; code: string; category: string; description: string
  fineAmount: number; active: boolean; _count: { items: number }
}

const CATEGORIES = ['Branching', 'Pull Request', 'Rails', 'RSpec', 'GraphQL']

export function RulesClient({ rules: initial, isAdmin }: { rules: Rule[]; isAdmin: boolean }) {
  const router = useRouter()
  const [rules, setRules] = useState(initial)
  useEffect(() => { setRules(initial) }, [initial])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Rule | null>(null)
  const [form, setForm] = useState({ code: '', category: '', description: '', fineAmount: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const grouped = useMemo(() => {
    const g: Record<string, Rule[]> = {}
    rules.forEach(r => { if (!g[r.category]) g[r.category] = []; g[r.category].push(r) })
    return g
  }, [rules])

  function openCreate() { setEditing(null); setForm({ code: '', category: '', description: '', fineAmount: '' }); setShowModal(true) }
  function openEdit(r: Rule) { setEditing(r); setForm({ code: r.code, category: r.category, description: r.description, fineAmount: String(r.fineAmount) }); setShowModal(true) }

  async function save() {
    setLoading(true); setError('')
    try {
      const payload = { ...form, fineAmount: parseFloat(form.fineAmount) }
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
        {isAdmin && <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Add Rule</button>}
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([cat, rules]) => (
          <div key={cat} className="card overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-semibold text-gray-700">{cat}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{rules.length} rules · Total: {formatCHF(rules.reduce((s, r) => s + r.fineAmount, 0))}</p>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Code</th>
                  <th className="table-th">Description</th>
                  <th className="table-th">Fine (Nu.)</th>
                  <th className="table-th">Used</th>
                  <th className="table-th">Status</th>
                  {isAdmin && <th className="table-th"></th>}
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-td font-mono text-sm font-medium text-blue-700">{r.code}</td>
                    <td className="table-td text-gray-600 text-xs max-w-[300px]">{r.description}</td>
                    <td className="table-td font-semibold text-red-600">{formatCHF(r.fineAmount)}</td>
                    <td className="table-td text-gray-500">{r._count.items}×</td>
                    <td className="table-td">
                      <span className={`badge ${r.active ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                        {r.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="table-td">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)} className="btn-ghost py-1 px-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => toggle(r)} className="btn-ghost py-1 px-1.5">
                            {r.active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
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
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input">
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Description *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input resize-none" />
            </div>
            <div>
              <label className="label">Fine Amount (Nu.) *</label>
              <input type="number" min="0" step="1" value={form.fineAmount} onChange={e => setForm(f => ({ ...f, fineAmount: e.target.value }))} className="input" placeholder="20" />
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
