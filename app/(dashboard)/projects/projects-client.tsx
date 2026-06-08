'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Project {
  id: string
  projectCode: string
  name: string
  type: string | null
  description: string | null
  active: boolean
  createdAt: Date
  _count: { violations: number; assignments: number }
}

export function ProjectsClient({ projects: initial, canEdit }: { projects: Project[]; canEdit: boolean }) {
  const router = useRouter()
  const [projects, setProjects] = useState(initial)
  // Keep local list in sync whenever the server component re-renders (router.refresh)
  useEffect(() => { setProjects(initial) }, [initial])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState({ projectCode: '', name: '', type: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openCreate() { setEditing(null); setForm({ projectCode: '', name: '', type: '', description: '' }); setShowModal(true) }
  function openEdit(p: Project) { setEditing(p); setForm({ projectCode: p.projectCode, name: p.name, type: p.type ?? '', description: p.description ?? '' }); setShowModal(true) }

  async function save() {
    setLoading(true); setError('')
    try {
      const res = editing
        ? await fetch(`/api/projects/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        : await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.fieldErrors ? 'Validation error' : d.error) }
      setShowModal(false); router.refresh()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function toggleActive(p: Project) {
    const next = !p.active
    // Optimistic update for instant, reliable feedback
    setProjects(prev => prev.map(x => x.id === p.id ? { ...x, active: next } : x))
    try {
      const res = await fetch(`/api/projects/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: next }) })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      // Revert on failure
      setProjects(prev => prev.map(x => x.id === p.id ? { ...x, active: p.active } : x))
    }
  }

  const types = ['Product', 'Client', 'Internal', 'Mobile']

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Projects</h1>
        {canEdit && <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Add Project</button>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">Code</th>
              <th className="table-th">Name</th>
              <th className="table-th">Type</th>
              <th className="table-th">Violations</th>
              <th className="table-th">Assignments</th>
              <th className="table-th">Status</th>
              {canEdit && <th className="table-th"></th>}
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.id} className="table-row">
                <td className="table-td font-mono text-xs font-medium text-gray-600">{p.projectCode}</td>
                <td className="table-td font-medium text-gray-900">{p.name}</td>
                <td className="table-td">{p.type ? <span className="badge bg-purple-50 text-purple-700 ring-purple-200">{p.type}</span> : '—'}</td>
                <td className="table-td">{p._count.violations}</td>
                <td className="table-td">{p._count.assignments}</td>
                <td className="table-td">
                  <span className={`badge ${p.active ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {canEdit && (
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} className="btn-ghost py-1 px-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => toggleActive(p)} className="btn-ghost py-1 px-1.5">
                        {p.active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="font-semibold text-gray-900">{editing ? 'Edit Project' : 'Add Project'}</h2>
            {!editing && (
              <div>
                <label className="label">Project Code *</label>
                <input value={form.projectCode} onChange={e => setForm(f => ({ ...f, projectCode: e.target.value.toUpperCase() }))} className="input" placeholder="ONEHUB" />
              </div>
            )}
            <div>
              <label className="label">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="OneHub" />
            </div>
            <div>
              <label className="label">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
                <option value="">Select type…</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input resize-none" />
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
