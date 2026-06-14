'use client'
import { useState, useEffect, useMemo } from 'react'
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
  teamId: string | null
  team: { id: string; name: string; slug: string } | null
  _count: { violations: number; assignments: number }
}
interface CaptainTeam { id: string; name: string; slug: string }

export function ProjectsClient({
  projects: initial, canEdit, isAdmin, captainTeams = [],
}: {
  projects: Project[]
  canEdit: boolean
  isAdmin: boolean
  captainTeams?: CaptainTeam[]
}) {
  const router = useRouter()
  const [projects, setProjects] = useState(initial)
  useEffect(() => { setProjects(initial) }, [initial])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState({
    projectCode: '', name: '', type: '', description: '',
    teamId: !isAdmin && captainTeams.length === 1 ? captainTeams[0].id : '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterTeam, setFilterTeam] = useState<string>('all')

  const teams = useMemo(() => {
    const map = new Map<string, { id: string; name: string; slug: string }>()
    projects.forEach(p => { if (p.team) map.set(p.team.id, p.team) })
    return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug))
  }, [projects])

  const filtered = useMemo(() => {
    if (filterTeam === 'all') return projects
    if (filterTeam === 'none') return projects.filter(p => !p.teamId)
    return projects.filter(p => p.teamId === filterTeam)
  }, [projects, filterTeam])

  function openCreate() {
    setEditing(null)
    setForm({
      projectCode: '', name: '', type: '', description: '',
      teamId: !isAdmin && captainTeams.length === 1 ? captainTeams[0].id : '',
    })
    setShowModal(true)
  }

  function openEdit(p: Project) {
    setEditing(p)
    setForm({ projectCode: p.projectCode, name: p.name, type: p.type ?? '', description: p.description ?? '', teamId: p.teamId ?? '' })
    setShowModal(true)
  }

  async function save() {
    setLoading(true); setError('')
    try {
      const payload = { ...form, teamId: form.teamId || null }
      const res = editing
        ? await fetch(`/api/projects/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.fieldErrors ? 'Validation error' : d.error) }
      setShowModal(false); router.refresh()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function toggleActive(p: Project) {
    const next = !p.active
    setProjects(prev => prev.map(x => x.id === p.id ? { ...x, active: next } : x))
    try {
      const res = await fetch(`/api/projects/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: next }) })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
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

      {/* Team tabs */}
      {teams.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterTeam('all')}
            className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${filterTeam === 'all' ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            All
          </button>
          {isAdmin && (
            <button onClick={() => setFilterTeam('none')}
              className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${filterTeam === 'none' ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              Global
            </button>
          )}
          {teams.map(t => (
            <button key={t.id} onClick={() => setFilterTeam(t.id)}
              className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${filterTeam === t.id ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <span className="font-bold text-xs mr-1">{t.slug}</span>{t.name}
            </button>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">Code</th>
              <th className="table-th">Name</th>
              <th className="table-th">Team</th>
              <th className="table-th">Type</th>
              <th className="table-th">Violations</th>
              <th className="table-th">Assignments</th>
              <th className="table-th">Status</th>
              {canEdit && <th className="table-th"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={canEdit ? 8 : 7} className="table-td text-center text-gray-400 py-10">No projects found</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="table-row">
                <td className="table-td font-mono text-xs font-medium text-gray-600">{p.projectCode}</td>
                <td className="table-td font-medium text-gray-900">{p.name}</td>
                <td className="table-td">
                  {p.team
                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{p.team.slug}</span>
                    : <span className="text-xs text-gray-400">Global</span>}
                </td>
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
                <input value={form.projectCode} onChange={e => setForm(f => ({ ...f, projectCode: e.target.value.toUpperCase() }))} className="input" placeholder="L3-RAILS-SUNRISE-PARTNERPORTAL" />
              </div>
            )}
            <div>
              <label className="label">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="Partner Portal" />
            </div>
            <div>
              <label className="label">Team</label>
              {isAdmin ? (
                <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} className="input">
                  <option value="">Global (no team)</option>
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
