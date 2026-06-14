'use client'
import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Minus, Plus, AlertCircle, ImagePlus, X } from 'lucide-react'
import { computeFine, getMultiplierLabel, PER_ITEM_RULES, PER_FILE_RULES, DUAL_FINE_RULES } from '@/lib/fine-calculator'
import { formatCHF } from '@/lib/utils'

interface Team { id: string; name: string; slug: string }
interface Rule { id: string; code: string; category: string; description: string; fineAmount: number; teamId: string | null }
interface Developer { id: string; name: string; employeeId: string; department: string }
interface Project { id: string; name: string; projectCode: string; teamId: string | null }

interface Props {
  teams: Team[]
  teamDeveloperIds: Record<string, string[]>
  developers: Developer[]
  projects: Project[]
  rules: Rule[]
  reporterId: string
}

interface SelectedRule {
  ruleId: string
  ruleCode: string
  fineAmount: number
  multiplier: number
  notes: string
}

export function NewViolationForm({ teams, teamDeveloperIds, developers, projects, rules, reporterId }: Props) {
  const router = useRouter()
  const [teamId, setTeamId] = useState(teams.length === 1 ? teams[0].id : '')
  const [developerId, setDeveloperId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [prLink, setPrLink] = useState('')
  const [evidenceImages, setEvidenceImages] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [approverDevId, setApproverDevId] = useState('')
  const [selected, setSelected] = useState<Record<string, SelectedRule>>({})
  // Start with all categories open
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Array.from(new Set(rules.map(r => r.category))).map(c => [c, true]))
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Developers that belong to the selected team
  const teamDevIds = useMemo(() => new Set(teamId ? (teamDeveloperIds[teamId] ?? []) : []), [teamId, teamDeveloperIds])
  const visibleDevelopers = useMemo(
    () => teamId ? developers.filter(d => teamDevIds.has(d.id)) : [],
    [developers, teamDevIds, teamId]
  )

  // Projects for the selected team: team-specific + global (teamId null)
  const visibleProjects = useMemo(
    () => teamId ? projects.filter(p => p.teamId === teamId || p.teamId === null) : [],
    [projects, teamId]
  )

  // Rules for the selected team: team-specific + global (teamId null)
  const visibleRules = useMemo(
    () => teamId ? rules.filter(r => r.teamId === teamId || r.teamId === null) : [],
    [rules, teamId]
  )

  const grouped = useMemo(() => {
    const g: Record<string, Rule[]> = {}
    visibleRules.forEach(r => { if (!g[r.category]) g[r.category] = []; g[r.category].push(r) })
    return g
  }, [visibleRules])

  const hasDual = Object.values(selected).some(s => DUAL_FINE_RULES.has(s.ruleCode))
  const fine = useMemo(() => computeFine(Object.values(selected)), [selected])

  function onTeamChange(id: string) {
    setTeamId(id)
    setDeveloperId('')
    setProjectId('')
    setSelected({})
    setApproverDevId('')
    // Open all categories for the newly selected team
    const teamRules = rules.filter(r => r.teamId === id || r.teamId === null)
    setOpenCategories(Object.fromEntries(Array.from(new Set(teamRules.map(r => r.category))).map(c => [c, true])))
  }

  function onDeveloperChange(id: string) {
    setDeveloperId(id)
    setSelected({})
    setApproverDevId('')
  }

  function toggleRule(rule: Rule) {
    setSelected(prev => {
      if (prev[rule.id]) { const next = { ...prev }; delete next[rule.id]; return next }
      return { ...prev, [rule.id]: { ruleId: rule.id, ruleCode: rule.code, fineAmount: rule.fineAmount, multiplier: 1, notes: '' } }
    })
  }

  function updateMultiplier(ruleId: string, val: number) {
    setSelected(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], multiplier: Math.max(1, val) } }))
  }

  function updateNotes(ruleId: string, val: string) {
    setSelected(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], notes: val } }))
  }

  async function addImageFiles(files: FileList | null) {
    if (!files) return
    const results = await Promise.all(
      Array.from(files).filter(f => f.type.startsWith('image/')).map(f =>
        new Promise<string>(res => { const r = new FileReader(); r.onload = e => res(e.target!.result as string); r.readAsDataURL(f) })
      )
    )
    setEvidenceImages(prev => [...prev, ...results])
  }

  function removeImage(index: number) {
    setEvidenceImages(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(asDraft: boolean) {
    if (!teamId || !developerId || !projectId || !prLink || Object.keys(selected).length === 0) {
      setError('Please fill in all required fields and select at least one rule.')
      return
    }
    if (hasDual && !approverDevId) {
      setError('SEL_PULL008 requires specifying the approver who missed the command check.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId, developerId, projectId, prLink,
          evidenceImages,
          approverDevId: hasDual ? approverDevId : undefined,
          status: asDraft ? 'DRAFT' : 'SUBMITTED',
          items: Object.values(selected),
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      const { id } = await res.json()
      router.push(`/violations/${id}`)
    } catch (e: any) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="page-title">Report Violation</h1>
        <p className="text-sm text-gray-500 mt-0.5">All fields marked * are required</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: form fields */}
        <div className="space-y-5">
          {/* Team tabs — shown when user is in multiple teams */}
          {teams.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => onTeamChange(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    teamId === t.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {t.name}
                  <span className={`ml-1.5 text-[10px] font-bold px-1 py-0.5 rounded ${teamId === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {t.slug}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Violation Details</h2>

            <div>
              <label className="label">Violator *</label>
              <select
                value={developerId}
                onChange={e => onDeveloperChange(e.target.value)}
                className="input"
                disabled={!teamId}
              >
                <option value="">{teamId ? 'Select developer…' : 'Select team first…'}</option>
                {visibleDevelopers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.employeeId})</option>)}
              </select>
            </div>

            <div>
              <label className="label">Project *</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className="input">
                <option value="">Select project…</option>
                {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>)}
              </select>
            </div>

            <div>
              <label className="label">PR Link *</label>
              <input
                type="url"
                value={prLink}
                onChange={e => setPrLink(e.target.value)}
                className="input"
                placeholder="https://github.com/org/repo/pull/123"
              />
              {prLink && !prLink.startsWith('https://github.com') && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Must be a GitHub URL</p>
              )}
            </div>

            <div>
              <label className="label">Evidence Images</label>
              <div
                className={`border-2 border-dashed rounded-xl transition-colors cursor-pointer ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addImageFiles(e.dataTransfer.files) }}
              >
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addImageFiles(e.target.files)} />
                {evidenceImages.length === 0 ? (
                  <div className="py-8 flex flex-col items-center gap-2 text-gray-400">
                    <ImagePlus className="w-7 h-7" />
                    <p className="text-sm">Click or drag images here</p>
                  </div>
                ) : (
                  <div className="p-3 grid grid-cols-3 gap-2">
                    {evidenceImages.map((img, i) => (
                      <div key={i} className="relative group aspect-square">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="w-full h-full object-cover rounded-lg" />
                        <button type="button" onClick={e => { e.stopPropagation(); removeImage(i) }}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <div className="aspect-square border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-300 hover:border-blue-300 hover:text-blue-400 transition-colors">
                      <Plus className="w-5 h-5" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {hasDual && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-xs font-medium text-orange-700 mb-2">SEL_PULL008 — Approver also fined Nu. 50</p>
                <label className="label">Approver Developer *</label>
                <select value={approverDevId} onChange={e => setApproverDevId(e.target.value)} className="input">
                  <option value="">Select approver…</option>
                  {visibleDevelopers.filter(d => d.id !== developerId).map(d =>
                    <option key={d.id} value={d.id}>{d.name}</option>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Fine summary */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Fine Summary</h2>
            {fine.items.length === 0 ? (
              <p className="text-sm text-gray-400">No rules selected yet</p>
            ) : (
              <div className="space-y-2">
                {fine.items.map(item => (
                  <div key={item.ruleId} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.ruleCode}
                      {item.multiplier > 1 && <span className="text-gray-400"> ×{item.multiplier}</span>}
                    </span>
                    <span className="font-medium text-gray-900">{formatCHF(item.lineTotal)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold">
                  <span>Developer Total</span>
                  <span className="text-red-600">{formatCHF(fine.developerTotal)}</span>
                </div>
                {fine.approverFine && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Approver Fine (auto)</span>
                    <span>{formatCHF(fine.approverFine)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => handleSubmit(false)} disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
            <button onClick={() => handleSubmit(true)} disabled={submitting} className="btn-secondary">
              Save Draft
            </button>
          </div>
        </div>

        {/* Right: rule selector */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Select Violation Rules *</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {!teamId
                ? 'Select a team first to see applicable rules'
                : `${visibleRules.length} rule(s) for this team · ${Object.keys(selected).length} selected`}
            </p>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {!teamId ? (
              <div className="p-8 text-center text-gray-400 text-sm">Select a team to load rules</div>
            ) : Object.entries(grouped).length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No rules configured for this team yet</div>
            ) : Object.entries(grouped).map(([cat, catRules]) => {
              const open = !!openCategories[cat]
              return (
                <div key={cat}>
                  <button
                    onClick={() => setOpenCategories(prev => ({ ...prev, [cat]: !open }))}
                    className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-700">{cat}</span>
                    <div className="flex items-center gap-2">
                      {catRules.filter(r => selected[r.id]).length > 0 && (
                        <span className="badge bg-blue-100 text-blue-700 ring-blue-200 text-[10px]">
                          {catRules.filter(r => selected[r.id]).length} selected
                        </span>
                      )}
                      {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {open && catRules.map(rule => {
                    const isSelected = !!selected[rule.id]
                    const mulLabel = getMultiplierLabel(rule.code)
                    const isDual = DUAL_FINE_RULES.has(rule.code)
                    return (
                      <div key={rule.id} className={`border-b border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-start gap-3 px-5 py-3 cursor-pointer" onClick={() => toggleRule(rule)}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRule(rule)}
                            className="mt-0.5 accent-blue-600" onClick={e => e.stopPropagation()} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-gray-900">{rule.code}</span>
                              <span className="text-sm font-semibold text-red-600 shrink-0">
                                {isDual ? 'Nu. 100 + 50' : formatCHF(rule.fineAmount)}
                                {mulLabel && <span className="text-gray-400 font-normal"> /item</span>}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rule.description}</p>
                          </div>
                        </div>
                        {isSelected && mulLabel && (
                          <div className="px-5 pb-3 pl-11">
                            <label className="text-xs font-medium text-gray-600">{mulLabel}</label>
                            <div className="flex items-center gap-2 mt-1">
                              <button onClick={() => updateMultiplier(rule.id, (selected[rule.id]?.multiplier ?? 1) - 1)}
                                className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                                <Minus className="w-3 h-3" />
                              </button>
                              <input type="number" min={1} value={selected[rule.id]?.multiplier ?? 1}
                                onChange={e => updateMultiplier(rule.id, parseInt(e.target.value) || 1)}
                                className="w-16 text-center input py-1" />
                              <button onClick={() => updateMultiplier(rule.id, (selected[rule.id]?.multiplier ?? 1) + 1)}
                                className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                                <Plus className="w-3 h-3" />
                              </button>
                              <span className="text-xs text-gray-500">= {formatCHF((selected[rule.id]?.fineAmount ?? 0) * (selected[rule.id]?.multiplier ?? 1))}</span>
                            </div>
                          </div>
                        )}
                        {isSelected && (
                          <div className="px-5 pb-3 pl-11">
                            <input type="text" placeholder="Notes (optional)…"
                              value={selected[rule.id]?.notes ?? ''}
                              onChange={e => updateNotes(rule.id, e.target.value)}
                              className="input text-xs py-1.5" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
