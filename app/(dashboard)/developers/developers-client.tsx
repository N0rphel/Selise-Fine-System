'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, Github, ToggleLeft, ToggleRight } from 'lucide-react'

interface Developer {
  id: string; employeeId: string; name: string; githubUsername: string | null
  department: string; team: string | null; active: boolean
  _count: { violations: number; assignments: number }
}

export function DevelopersClient({ developers: initial, canEdit }: { developers: Developer[]; canEdit: boolean }) {
  const router = useRouter()
  const [developers, setDevelopers] = useState(initial)
  useEffect(() => { setDevelopers(initial) }, [initial])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Developer | null>(null)
  const [form, setForm] = useState({ employeeId: '', name: '', githubUsername: '', department: '', team: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openCreate() { setEditing(null); setForm({ employeeId: '', name: '', githubUsername: '', department: '', team: '' }); setShowModal(true) }
  function openEdit(d: Developer) { setEditing(d); setForm({ employeeId: d.employeeId, name: d.name, githubUsername: d.githubUsername ?? '', department: d.department, team: d.team ?? '' }); setShowModal(true) }

  async function save() {
    setLoading(true); setError('')
    try {
      const res = editing
        ? await fetch(`/api/developers/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        : await fetch('/api/developers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.fieldErrors ? 'Validation error' : String(d.error)) }
      setShowModal(false); router.refresh()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function toggle(d: Developer) {
    const next = !d.active
    setDevelopers(prev => prev.map(x => x.id === d.id ? { ...x, active: next } : x))
    try {
      const res = await fetch(`/api/developers/${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: next }) })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setDevelopers(prev => prev.map(x => x.id === d.id ? { ...x, active: d.active } : x))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Developers</h1>
        {canEdit && <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Add Developer</button>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">Employee ID</th>
              <th className="table-th">Name</th>
              <th className="table-th">GitHub</th>
              <th className="table-th">Department</th>
              <th className="table-th">Team</th>
              <th className="table-th">Violations</th>
              <th className="table-th">Assignments</th>
              <th className="table-th">Status</th>
              {canEdit && <th className="table-th"></th>}
            </tr>
          </thead>
          <tbody>
            {developers.map(d => (
              <tr key={d.id} className="table-row">
                <td className="table-td font-mono text-xs text-gray-500">{d.employeeId}</td>
                <td className="table-td font-medium text-gray-900">{d.name}</td>
                <td className="table-td">
                  {d.githubUsername ? (
                    <span className="flex items-center gap-1 text-gray-600 text-xs"><Github className="w-3.5 h-3.5" />{d.githubUsername}</span>
                  ) : '—'}
                </td>
                <td className="table-td">{d.department}</td>
                <td className="table-td">{d.team ?? '—'}</td>
                <td className="table-td">{d._count.violations}</td>
                <td className="table-td">{d._count.assignments}</td>
                <td className="table-td">
                  <span className={`badge ${d.active ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-100 text-gray-500 ring-gray-200'}`}>
                    {d.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {canEdit && (
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(d)} className="btn-ghost py-1 px-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => toggle(d)} className="btn-ghost py-1 px-1.5">
                        {d.active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
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
            <h2 className="font-semibold text-gray-900">{editing ? 'Edit Developer' : 'Add Developer'}</h2>
            {[
              { label: 'Employee ID', key: 'employeeId', placeholder: 'EMP001' },
              { label: 'Full Name', key: 'name', placeholder: 'Kinley Wangchuk' },
              { label: 'GitHub Username', key: 'githubUsername', placeholder: 'KinWang-2013' },
              { label: 'Department', key: 'department', placeholder: 'Engineering' },
              { label: 'Team', key: 'team', placeholder: 'Backend' },
            ].map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="input" placeholder={f.placeholder} />
              </div>
            ))}
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
