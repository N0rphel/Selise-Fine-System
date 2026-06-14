'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, Plus, XCircle, ChevronRight, Users,
  CheckCircle, Clock, ChevronLeft,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import Link from 'next/link'

export interface SessionRow {
  id: string
  date: string
  title: string | null
  status: string
  cancelNote: string | null
  teamId: string | null
  teamSlug: string | null
  presentCount: number
  absentCount: number
  excusedCount: number
  pendingCount: number
  totalDevs: number
}

interface CaptainTeam { id: string; name: string; slug: string }

interface Props {
  sessions: SessionRow[]
  isAdmin: boolean
  canManage: boolean
  captainTeams: CaptainTeam[]
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

interface DonutSegment { value: number; color: string; label: string }

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const R = 38
  const C = 2 * Math.PI * R
  let offset = 0
  const arcs = segments.map((s, i) => {
    const pct = total > 0 ? s.value / total : 0
    const arc = pct * C
    const el = (
      <circle
        key={i}
        r={R} cx={50} cy={50}
        fill="none"
        stroke={s.color}
        strokeWidth={11}
        strokeDasharray={`${arc} ${C}`}
        strokeDashoffset={-(offset * C)}
        strokeLinecap="butt"
      />
    )
    offset += pct
    return el
  })
  const pct = total > 0 ? Math.round((segments[0]?.value ?? 0) / total * 100) : 0
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
      <circle r={R} cx={50} cy={50} fill="none" stroke="currentColor" strokeWidth={11} className="text-gray-100 dark:text-white/10" />
      {arcs}
      <text x={50} y={50} textAnchor="middle" dominantBaseline="middle" className="rotate-90" style={{ transform: 'rotate(90deg)', transformOrigin: '50px 50px', fontSize: 16, fontWeight: 700, fill: 'currentColor' }}>
        {pct}%
      </text>
    </svg>
  )
}

// ─── Stacked bar chart ────────────────────────────────────────────────────────

function AttendanceBarChart({ sessions }: { sessions: SessionRow[] }) {
  // Show last 12 scheduled sessions, chronological order (oldest → newest left to right)
  const visible = sessions
    .filter(s => s.status === 'SCHEDULED' && s.totalDevs > 0)
    .slice(-12)

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400">
        No session data yet
      </div>
    )
  }

  const BAR_W   = 32
  const GAP     = 14
  const CHART_H = 120
  const PAD_L   = 36
  const PAD_B   = 28
  const totalW  = PAD_L + visible.length * (BAR_W + GAP) + 10

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalW} ${CHART_H + PAD_B + 8}`}
        className="w-full min-w-[320px]"
        style={{ maxHeight: 200 }}
      >
        {/* Y-axis gridlines + labels */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = 4 + CHART_H * (1 - pct / 100)
          return (
            <g key={pct}>
              <line x1={PAD_L - 4} y1={y} x2={totalW - 4} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
              <text x={PAD_L - 6} y={y + 1} textAnchor="end" dominantBaseline="middle" fontSize={7} fill="currentColor" fillOpacity={0.4}>
                {pct}%
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {visible.map((s, i) => {
          const x  = PAD_L + i * (BAR_W + GAP)
          const t  = s.totalDevs
          const pP = s.presentCount / t
          const pE = s.excusedCount / t
          const pA = s.absentCount  / t
          const pN = s.pendingCount / t

          const hP = CHART_H * pP
          const hE = CHART_H * pE
          const hA = CHART_H * pA
          const hN = CHART_H * pN

          let yOff = 4 + CHART_H   // build from bottom up

          const segments = [
            { h: hN, fill: '#9ca3af' },  // pending — gray
            { h: hA, fill: '#ef4444' },  // absent  — red
            { h: hE, fill: '#eab308' },  // excused — yellow
            { h: hP, fill: '#22c55e' },  // present — green
          ]

          const rects = segments.map((seg, si) => {
            if (seg.h < 0.5) return null
            yOff -= seg.h
            return <rect key={si} x={x} y={yOff} width={BAR_W} height={seg.h} fill={seg.fill} rx={si === 3 ? 3 : 0} />
          })

          const d = new Date(s.date)
          const label = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
          const attendRate = Math.round(pP * 100)

          return (
            <g key={s.id}>
              {rects}
              {/* % label above bar */}
              <text
                x={x + BAR_W / 2} y={4 + CHART_H * (1 - pP) - 3}
                textAnchor="middle" fontSize={7.5} fontWeight={600}
                fill="currentColor" fillOpacity={0.6}
              >
                {attendRate > 0 ? `${attendRate}%` : ''}
              </text>
              {/* date label below */}
              <text
                x={x + BAR_W / 2} y={4 + CHART_H + PAD_B - 18}
                textAnchor="middle" fontSize={7} fill="currentColor" fillOpacity={0.5}
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Charts section ───────────────────────────────────────────────────────────

function ChartsSection({ sessions }: { sessions: SessionRow[] }) {
  const scheduled = sessions.filter(s => s.status === 'SCHEDULED')
  const totalPresent  = scheduled.reduce((n, s) => n + s.presentCount,  0)
  const totalAbsent   = scheduled.reduce((n, s) => n + s.absentCount,   0)
  const totalExcused  = scheduled.reduce((n, s) => n + s.excusedCount,  0)
  const totalPending  = scheduled.reduce((n, s) => n + s.pendingCount,  0)
  const grandTotal    = totalPresent + totalAbsent + totalExcused + totalPending

  const avgRate = scheduled.length > 0
    ? Math.round(scheduled.reduce((n, s) => n + (s.totalDevs > 0 ? s.presentCount / s.totalDevs : 0), 0) / scheduled.length * 100)
    : 0

  const bestSession = scheduled.reduce<SessionRow | null>((best, s) => {
    if (!s.totalDevs) return best
    if (!best || s.presentCount / s.totalDevs > best.presentCount / best.totalDevs) return s
    return best
  }, null)

  if (scheduled.length === 0) return null

  const donutSegments: DonutSegment[] = [
    { value: totalPresent, color: '#22c55e', label: 'Present' },
    { value: totalExcused, color: '#eab308', label: 'Excused' },
    { value: totalAbsent,  color: '#ef4444', label: 'Absent'  },
    { value: totalPending, color: '#9ca3af', label: 'Pending' },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Donut + legend */}
      <div className="card p-5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Overall Distribution</p>
        <div className="flex items-center gap-5">
          <div className="w-28 h-28 shrink-0">
            <DonutChart segments={donutSegments} total={grandTotal} />
          </div>
          <div className="space-y-2 min-w-0">
            {donutSegments.map(seg => (
              <div key={seg.label} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: seg.color }} />
                <span className="text-gray-600 dark:text-gray-400 truncate">{seg.label}</span>
                <span className="ml-auto font-semibold text-gray-800 dark:text-white tabular-nums">{seg.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="card p-5 space-y-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Quick Stats</p>
        <div className="space-y-3">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{scheduled.length}</p>
            <p className="text-xs text-gray-500">Total sessions held</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{avgRate}%</p>
            <p className="text-xs text-gray-500">Average attendance rate</p>
          </div>
          {bestSession && (
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">{formatDate(bestSession.date)}</p>
              <p className="text-xs text-gray-500">Best session · {Math.round(bestSession.presentCount / bestSession.totalDevs * 100)}% present</p>
            </div>
          )}
        </div>
      </div>

      {/* Bar chart */}
      <div className="card p-5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Attendance per Session</p>
        <div className="flex gap-3 mb-3 text-[10px] text-gray-500">
          {[['#22c55e','Present'],['#eab308','Excused'],['#ef4444','Absent'],['#9ca3af','Pending']].map(([c,l]) => (
            <span key={l} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: c }} />{l}
            </span>
          ))}
        </div>
        <AttendanceBarChart sessions={sessions} />
      </div>
    </div>
  )
}

// ─── Calendar multi-date picker ───────────────────────────────────────────────

const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December']

interface CalendarPickerProps {
  selected: Set<string>
  onToggle: (key: string) => void
  alreadyScheduled: Set<string>
}

function CalendarPicker({ selected, onToggle, alreadyScheduled }: CalendarPickerProps) {
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  function prev() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
  function next() { if (viewMonth === 11) { setViewMonth(0);  setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }

  const days = useMemo(() => {
    const firstDow  = new Date(viewYear, viewMonth, 1).getDay()
    const offset    = firstDow === 0 ? 6 : firstDow - 1
    const inMonth   = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= inMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [viewYear, viewMonth])

  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prev} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-white">{MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={next} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => <div key={d} className="text-center text-[10px] font-medium text-gray-400 uppercase py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (!day) return <div key={i} />
          const key = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday     = key === todayKey
          const isSelected  = selected.has(key)
          const isScheduled = alreadyScheduled.has(key)
          return (
            <button
              key={key} type="button"
              onClick={() => !isScheduled && onToggle(key)}
              disabled={isScheduled}
              title={isScheduled ? 'Already scheduled' : undefined}
              className={cn(
                'relative h-9 w-full rounded-lg text-sm font-medium transition-colors',
                isScheduled  && 'cursor-not-allowed opacity-40 bg-gray-100 dark:bg-white/5',
                !isScheduled && isSelected  && 'bg-blue-600 text-white hover:bg-blue-700',
                !isScheduled && !isSelected && isToday  && 'ring-2 ring-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30',
                !isScheduled && !isSelected && !isToday && 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10',
              )}
            >
              {day}
              {isScheduled && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[10px] text-gray-400 text-center">Blue dot = already scheduled</p>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return status === 'CANCELLED'
    ? <span className="badge bg-red-50 text-red-700 ring-red-200">Cancelled</span>
    : <span className="badge bg-green-50 text-green-700 ring-green-200">Scheduled</span>
}

// ─── Main client ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

export function AttendanceClient({ sessions, isAdmin, canManage, captainTeams }: Props) {
  const router = useRouter()

  // ── Schedule modal state
  const [showSchedule, setShowSchedule] = useState(false)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [newTitle, setNewTitle] = useState('')
  const [scheduleTeamId, setScheduleTeamId] = useState(
    !isAdmin && captainTeams.length === 1 ? captainTeams[0].id : ''
  )
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // ── Team filter tabs
  const [filterTeam, setFilterTeam] = useState<string>('all')
  const teams = useMemo(() => {
    const map = new Map<string, { id: string; slug: string }>()
    sessions.forEach(s => { if (s.teamId && s.teamSlug) map.set(s.teamId, { id: s.teamId, slug: s.teamSlug }) })
    return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug))
  }, [sessions])
  const filteredSessions = useMemo(() =>
    filterTeam === 'all' ? sessions : sessions.filter(s => s.teamId === filterTeam),
  [sessions, filterTeam])

  // ── Cancel modal state
  const [cancelTarget, setCancelTarget] = useState<SessionRow | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // ── Pagination
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE))
  const pageStart  = (page - 1) * PAGE_SIZE
  const pageItems  = filteredSessions.slice(pageStart, pageStart + PAGE_SIZE)

  // Already-scheduled dates for the calendar picker (grayed out)
  const alreadyScheduled = useMemo(() =>
    new Set(sessions
      .filter(s => s.status === 'SCHEDULED')
      .map(s => {
        const d = new Date(s.date)
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
      })
    ), [sessions])

  function toggleDate(key: string) {
    setSelectedDates(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function removeDate(key: string) {
    setSelectedDates(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  function openSchedule() {
    setSelectedDates(new Set()); setNewTitle(''); setErrors([])
    setScheduleTeamId(!isAdmin && captainTeams.length === 1 ? captainTeams[0].id : '')
    setShowSchedule(true)
  }

  async function scheduleSession() {
    if (!selectedDates.size) { setErrors(['Pick at least one date']); return }
    setSaving(true); setErrors([])
    const sorted = Array.from(selectedDates).sort()
    const results = await Promise.all(
      sorted.map(date =>
        fetch('/api/attendance/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, title: newTitle || undefined, teamId: scheduleTeamId || undefined }),
        }).then(r => r.json().then(d => ({ ok: r.ok, date, data: d })))
      )
    )
    const failed = results.filter(r => !r.ok)
    if (failed.length) setErrors(failed.map(f => `${f.date}: ${f.data?.error ?? 'Failed'}`))
    if (failed.length < sorted.length) { if (!failed.length) setShowSchedule(false); router.refresh() }
    setSaving(false)
  }

  async function cancelSession() {
    if (!cancelTarget) return
    setCancelling(true)
    await fetch(`/api/attendance/sessions/${cancelTarget.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED', cancelNote: cancelNote || null }),
    })
    setCancelling(false); setCancelTarget(null); setCancelNote(''); router.refresh()
  }

  async function restoreSession(s: SessionRow) {
    await fetch(`/api/attendance/sessions/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SCHEDULED', cancelNote: null }),
    })
    router.refresh()
  }

  const sortedSelected = useMemo(() => Array.from(selectedDates).sort(), [selectedDates])

  // Pagination helper
  function pageNums() {
    const nums: (number | '…')[] = []
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) nums.push(p)
      else if (nums[nums.length - 1] !== '…') nums.push('…')
    }
    return nums
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track PR session attendance for all developers</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={openSchedule}>
            <Plus className="w-4 h-4" /> Schedule Sessions
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
            <button key={t.id} onClick={() => setFilterTeam(t.id)}
              className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${filterTeam === t.id ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {t.slug}
            </button>
          ))}
        </div>
      )}

      {/* Charts */}
      <ChartsSection sessions={filteredSessions} />

      {/* ── Schedule modal ─────────────────────────────────────────────────────── */}
      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-gray-900 dark:text-white">Schedule PR Sessions</h2>

            <CalendarPicker selected={selectedDates} onToggle={toggleDate} alreadyScheduled={alreadyScheduled} />

            {sortedSelected.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Selected ({sortedSelected.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {sortedSelected.map(key => (
                    <span key={key} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 ring-1 ring-blue-200 rounded-full px-2.5 py-1">
                      {formatDate(key + 'T00:00:00Z')}
                      <button type="button" onClick={() => removeDate(key)} className="ml-0.5 hover:text-blue-900"><XCircle className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team</label>
              {isAdmin ? (
                <select value={scheduleTeamId} onChange={e => setScheduleTeamId(e.target.value)} className="input w-full">
                  <option value="">Global (all developers)</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.slug}</option>)}
                </select>
              ) : captainTeams.length === 1 ? (
                <input value={`${captainTeams[0].name} (${captainTeams[0].slug})`} className="input w-full bg-gray-50" disabled />
              ) : (
                <select value={scheduleTeamId} onChange={e => setScheduleTeamId(e.target.value)} className="input w-full">
                  <option value="">Select team…</option>
                  {captainTeams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span className="text-gray-400 font-normal">(optional, applies to all)</span>
              </label>
              <input type="text" placeholder="e.g. Sprint 42 PR Review" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="input w-full" />
            </div>

            {errors.length > 0 && <div className="space-y-1">{errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}</div>}

            <div className="flex gap-2 justify-end pt-1">
              <button className="btn-secondary" onClick={() => setShowSchedule(false)}>Cancel</button>
              <button className="btn-primary" onClick={scheduleSession} disabled={saving || !selectedDates.size}>
                {saving ? 'Scheduling…' : !selectedDates.size ? 'Pick dates' : `Schedule ${selectedDates.size} session${selectedDates.size > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel modal ───────────────────────────────────────────────────────── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Cancel Session</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cancel the PR session on <strong>{formatDate(cancelTarget.date)}</strong>?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" placeholder="e.g. Public holiday" value={cancelNote} onChange={e => setCancelNote(e.target.value)} className="input w-full" />
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => { setCancelTarget(null); setCancelNote('') }}>Back</button>
              <button className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors" onClick={cancelSession} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Cancel Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sessions list ──────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">PR Sessions</h2>
          {filteredSessions.length > 0 && (
            <span className="text-xs text-gray-400">
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredSessions.length)} of {filteredSessions.length}
            </span>
          )}
        </div>

        {filteredSessions.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No sessions scheduled yet.</p>
            {canManage && (
              <button className="mt-3 btn-primary text-sm" onClick={openSchedule}>
                <Plus className="w-4 h-4" /> Schedule First Session
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 dark:divide-white/10">
              {pageItems.map(s => (
                <div key={s.id} className={cn('px-5 py-4 flex items-center gap-4', s.status === 'CANCELLED' && 'opacity-55')}>
                  {/* Date block */}
                  <div className="w-14 text-center shrink-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      {new Date(s.date).toLocaleDateString('en-GB', { month: 'short' })}
                    </p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white leading-none">
                      {new Date(s.date).getUTCDate()}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short' })}
                    </p>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{s.title || 'PR Session'}</p>
                      <StatusBadge status={s.status} />
                      {s.teamSlug && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{s.teamSlug}</span>
                      )}
                    </div>
                    {s.cancelNote && <p className="text-xs text-gray-500 mt-0.5">{s.cancelNote}</p>}
                    {s.status === 'SCHEDULED' && (
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" />{s.presentCount} present</span>
                        <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />{s.absentCount} absent</span>
                        {s.excusedCount > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-500" />{s.excusedCount} excused</span>}
                        {s.pendingCount > 0 && <span className="flex items-center gap-1 text-gray-400"><Users className="w-3 h-3" />{s.pendingCount} pending</span>}
                        {s.totalDevs > 0 && (
                          <span className="ml-auto font-medium text-green-600">
                            {Math.round(s.presentCount / s.totalDevs * 100)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && s.status === 'SCHEDULED' && (
                      <button onClick={() => { setCancelTarget(s); setCancelNote('') }} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                        Cancel
                      </button>
                    )}
                    {canManage && s.status === 'CANCELLED' && (
                      <button onClick={() => restoreSession(s)} className="text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors">
                        Restore
                      </button>
                    )}
                    <Link href={`/attendance/${s.id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                      View <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>

                {pageNums().map((n, i) =>
                  n === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n as number)}
                      className={cn(
                        'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                        page === n
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                      )}
                    >
                      {n}
                    </button>
                  )
                )}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
