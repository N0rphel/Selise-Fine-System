'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Zap, Send, Trash2, UserPlus } from 'lucide-react'
import { formatDate, CYCLE_STATUS_COLORS } from '@/lib/utils'

interface Developer { id: string; name: string; department: string }
interface Project { id: string; name: string; projectCode: string }
interface Assignment { id: string; projectId: string; developerId: string; locked: boolean; project: Project; developer: Developer }
interface Cycle { id: string; name: string; startDate: Date; endDate: Date; status: string; assignments: Assignment[] }
interface CycleRef { id: string; name: string }

interface Props {
  cycle: Cycle
  developers: Developer[]
  projects: Project[]
  allCycles: CycleRef[]
  canManage: boolean
}

export function CycleDetailClient({ cycle, developers, projects, allCycles, canManage }: Props) {
  const router = useRouter()
  const [reviewersPerProject, setReviewersPerProject] = useState(4)
  const [maxProjects, setMaxProjects] = useState(3)
  const [prevCycleId, setPrevCycleId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState<{ projectId: string } | null>(null)
  const [addDevId, setAddDevId] = useState('')

  const byProject = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    cycle.assignments.forEach(a => {
      if (!map.has(a.projectId)) map.set(a.projectId, [])
      map.get(a.projectId)!.push(a)
    })
    return map
  }, [cycle.assignments])

  const devCount = useMemo(() => {
    const c: Record<string, number> = {}
    cycle.assignments.forEach(a => { c[a.developerId] = (c[a.developerId] ?? 0) + 1 })
    return c
  }, [cycle.assignments])

  const coveredProjects = byProject.size
  const totalProjects = projects.length
  const avgAssignment = developers.length ? (cycle.assignments.length / developers.length).toFixed(1) : '0'

  async function generate() {
    setGenerating(true); setError('')
    try {
      const res = await fetch('/api/assignments/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId: cycle.id, reviewersPerProject, maxProjectsPerDeveloper: maxProjects, previousCycleId: prevCycleId || undefined }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(String(d.error)) }
      router.refresh()
    } catch (e: any) { setError(e.message) } finally { setGenerating(false) }
  }

  async function publish() {
    setPublishing(true); setError('')
    try {
      const res = await fetch('/api/assignments/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId: cycle.id }),
      })
      if (!res.ok) throw new Error('Failed to publish')
      router.refresh()
    } catch (e: any) { setError(e.message) } finally { setPublishing(false) }
  }

  async function removeAssignment(id: string) {
    await fetch('/api/assignments/remove', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: id }),
    })
    router.refresh()
  }

  async function addAssignment() {
    if (!showAddModal || !addDevId) return
    await fetch('/api/assignments/cycles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId: cycle.id, projectId: showAddModal.projectId, developerId: addDevId }),
    })
    setShowAddModal(null); setAddDevId(''); router.refresh()
  }

  const otherCycles = allCycles.filter(c => c.id !== cycle.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/assignments" className="btn-ghost py-1.5 px-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <h1 className="page-title">{cycle.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(cycle.startDate)} — {formatDate(cycle.endDate)}</p>
        </div>
        <span className={`badge ${CYCLE_STATUS_COLORS[cycle.status]}`}>{cycle.status}</span>
        {canManage && cycle.status === 'DRAFT' && cycle.assignments.length > 0 && (
          <button onClick={publish} disabled={publishing} className="btn-success">
            <Send className="w-4 h-4" />{publishing ? 'Publishing…' : 'Publish Cycle'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Projects Covered', value: `${coveredProjects}/${totalProjects}`, sub: `${Math.round(coveredProjects/Math.max(totalProjects,1)*100)}% coverage` },
          { label: 'Avg Assignments', value: avgAssignment, sub: 'per developer' },
          { label: 'Total Assignments', value: cycle.assignments.length, sub: 'reviewer slots' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {canManage && cycle.status === 'DRAFT' && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Generate Assignments</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Reviewers per Project</label>
              <input type="number" min={1} max={10} value={reviewersPerProject} onChange={e => setReviewersPerProject(parseInt(e.target.value))} className="input" />
            </div>
            <div>
              <label className="label">Max Projects per Dev</label>
              <input type="number" min={1} max={10} value={maxProjects} onChange={e => setMaxProjects(parseInt(e.target.value))} className="input" />
            </div>
            <div>
              <label className="label">Avoid Repeats From</label>
              <select value={prevCycleId} onChange={e => setPrevCycleId(e.target.value)} className="input">
                <option value="">None</option>
                {otherCycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
          <button onClick={generate} disabled={generating} className="btn-primary mt-4">
            <Zap className="w-4 h-4" />{generating ? 'Generating…' : 'Generate Assignments'}
          </button>
        </div>
      )}

      {cycle.assignments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Project Assignments</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {projects
              .filter(p => byProject.has(p.id))
              .map(project => {
                const assigned = byProject.get(project.id) ?? []
                return (
                  <div key={project.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900">{project.name}</span>
                        <span className="text-xs text-gray-400 ml-2">({project.projectCode})</span>
                      </div>
                      {canManage && cycle.status === 'DRAFT' && (
                        <button onClick={() => setShowAddModal({ projectId: project.id })} className="btn-ghost py-1 px-2 text-xs">
                          <UserPlus className="w-3.5 h-3.5" />Add
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {assigned.map(a => (
                        <div key={a.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full pl-3 pr-2 py-1">
                          <span className="text-xs font-medium text-blue-800">{a.developer.name}</span>
                          {canManage && cycle.status === 'DRAFT' && !a.locked && (
                            <button onClick={() => removeAssignment(a.id)} className="w-4 h-4 flex items-center justify-center text-blue-400 hover:text-red-500 transition-colors ml-1">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {cycle.assignments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Developer Load</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Developer</th>
                  <th className="table-th">Department</th>
                  <th className="table-th">Assigned Projects</th>
                  <th className="table-th">Projects</th>
                </tr>
              </thead>
              <tbody>
                {developers
                  .filter(d => devCount[d.id])
                  .sort((a, b) => (devCount[b.id] ?? 0) - (devCount[a.id] ?? 0))
                  .map(d => {
                    const assignedProjects = cycle.assignments.filter(a => a.developerId === d.id).map(a => a.project.name)
                    return (
                      <tr key={d.id} className="table-row">
                        <td className="table-td font-medium text-gray-900">{d.name}</td>
                        <td className="table-td text-gray-500">{d.department}</td>
                        <td className="table-td">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[120px]">
                              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min((devCount[d.id] ?? 0) / maxProjects * 100, 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-gray-700">{devCount[d.id] ?? 0}/{maxProjects}</span>
                          </div>
                        </td>
                        <td className="table-td">
                          <div className="flex flex-wrap gap-1">
                            {assignedProjects.map(p => (
                              <span key={p} className="badge bg-gray-100 text-gray-600 ring-gray-200 text-[10px]">{p}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h2 className="font-semibold text-gray-900">Add Reviewer</h2>
            <div>
              <label className="label">Developer</label>
              <select value={addDevId} onChange={e => setAddDevId(e.target.value)} className="input">
                <option value="">Select developer…</option>
                {developers
                  .filter(d => !cycle.assignments.some(a => a.projectId === showAddModal.projectId && a.developerId === d.id))
                  .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={addAssignment} disabled={!addDevId} className="btn-primary flex-1">Add</button>
              <button onClick={() => setShowAddModal(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
