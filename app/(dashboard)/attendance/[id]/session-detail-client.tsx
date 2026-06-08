'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Users,
  AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import Link from 'next/link'
import { cn, formatDate } from '@/lib/utils'

interface Developer {
  id: string
  name: string
  employeeId: string
  department: string
  team: string | null
}

interface AttendanceRecord {
  id: string
  sessionId: string
  developerId: string
  status: string
  reason: string | null
  developer: Developer
}

interface PrSession {
  id: string
  date: string
  title: string | null
  status: string
  cancelNote: string | null
  attendances: AttendanceRecord[]
}

interface Props {
  prSession: PrSession
  isAdmin: boolean
}

const STATUS_CONFIG = {
  PRESENT:  { label: 'Present',  bg: 'bg-green-50  dark:bg-green-900/20', text: 'text-green-700  dark:text-green-400', ring: 'ring-green-200 dark:ring-green-800', icon: CheckCircle },
  ABSENT:   { label: 'Absent',   bg: 'bg-red-50    dark:bg-red-900/20',   text: 'text-red-700    dark:text-red-400',   ring: 'ring-red-200   dark:ring-red-800',   icon: XCircle },
  EXCUSED:  { label: 'Excused',  bg: 'bg-yellow-50 dark:bg-yellow-900/20',text: 'text-yellow-700 dark:text-yellow-400',ring: 'ring-yellow-200 dark:ring-yellow-800',icon: Clock },
  PENDING:  { label: 'Pending',  bg: 'bg-gray-50   dark:bg-gray-800',     text: 'text-gray-500   dark:text-gray-400',  ring: 'ring-gray-200  dark:ring-gray-700',  icon: AlertCircle },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING
  return (
    <span className={cn('badge', cfg.bg, cfg.text, cfg.ring)}>
      {cfg.label}
    </span>
  )
}

export function SessionDetailClient({ prSession, isAdmin }: Props) {
  const router = useRouter()
  const [records, setRecords] = useState<Record<string, { status: string; reason: string | null }>>(
    Object.fromEntries(prSession.attendances.map(a => [a.developerId, { status: a.status, reason: a.reason }]))
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [excuseTarget, setExcuseTarget] = useState<Developer | null>(null)
  const [excuseReason, setExcuseReason] = useState('')
  const [showAbsent, setShowAbsent] = useState(true)
  const [showPresent, setShowPresent] = useState(false)

  const isCancelled = prSession.status === 'CANCELLED'

  async function markOne(developerId: string, status: string, reason?: string) {
    setSaving(developerId)
    await fetch(`/api/attendance/sessions/${prSession.id}/records`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ developerId, status, reason: reason ?? null }] }),
    })
    setRecords(prev => ({ ...prev, [developerId]: { status, reason: reason ?? null } }))
    setSaving(null)
  }

  async function markAllPresent() {
    const pending = prSession.attendances.filter(a => records[a.developerId]?.status === 'PENDING')
    if (pending.length === 0) return
    setSaving('bulk')
    await fetch(`/api/attendance/sessions/${prSession.id}/records`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: pending.map(a => ({ developerId: a.developerId, status: 'PRESENT' })) }),
    })
    const updated: Record<string, { status: string; reason: string | null }> = { ...records }
    pending.forEach(a => { updated[a.developerId] = { status: 'PRESENT', reason: null } })
    setRecords(updated)
    setSaving(null)
  }

  async function confirmExcuse() {
    if (!excuseTarget) return
    await markOne(excuseTarget.id, 'EXCUSED', excuseReason || undefined)
    setExcuseTarget(null); setExcuseReason('')
  }

  const devs = prSession.attendances.map(a => a.developer)
  const absentDevs = devs.filter(d => ['ABSENT', 'PENDING'].includes(records[d.id]?.status ?? 'PENDING'))
  const excusedDevs = devs.filter(d => records[d.id]?.status === 'EXCUSED')
  const presentDevs = devs.filter(d => records[d.id]?.status === 'PRESENT')
  const pendingCount = devs.filter(d => records[d.id]?.status === 'PENDING').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/attendance" className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="page-title">{prSession.title || 'PR Session'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(prSession.date)}</p>
        </div>
        {isCancelled && (
          <span className="badge bg-red-50 text-red-700 ring-red-200 mt-1">Cancelled</span>
        )}
      </div>

      {isCancelled && prSession.cancelNote && (
        <div className="card p-4 border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            <strong>Cancellation reason:</strong> {prSession.cancelNote}
          </p>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Present',  count: presentDevs.length,  color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20',  Icon: CheckCircle },
          { label: 'Absent',   count: absentDevs.length - pendingCount + pendingCount, count2: absentDevs.filter(d => records[d.id]?.status === 'ABSENT').length, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', Icon: XCircle },
          { label: 'Excused',  count: excusedDevs.length,  color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', Icon: Clock },
          { label: 'Pending',  count: pendingCount,          color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800',  Icon: AlertCircle },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl p-4', s.bg)}>
            <div className="flex items-center gap-2 mb-1">
              <s.Icon className={cn('w-4 h-4', s.color)} />
              <span className={cn('text-xs font-medium', s.color)}>{s.label}</span>
            </div>
            <p className={cn('text-2xl font-bold', s.color)}>
              {s.label === 'Absent' ? absentDevs.filter(d => records[d.id]?.status === 'ABSENT').length + pendingCount : s.count}
            </p>
          </div>
        ))}
      </div>

      {/* Bulk action */}
      {isAdmin && !isCancelled && pendingCount > 0 && (
        <div className="card p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>{pendingCount}</strong> developer{pendingCount !== 1 ? 's' : ''} not yet marked.
          </p>
          <button
            className="btn-secondary text-sm flex items-center gap-1.5"
            onClick={markAllPresent}
            disabled={saving === 'bulk'}
          >
            <CheckCircle className="w-4 h-4 text-green-600" />
            {saving === 'bulk' ? 'Marking…' : 'Mark all remaining as Present'}
          </button>
        </div>
      )}

      {/* Absentees section (main focus) */}
      <div className="card">
        <button
          className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/10"
          onClick={() => setShowAbsent(v => !v)}
        >
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Absentees</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              {absentDevs.length}
            </span>
          </div>
          {showAbsent ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showAbsent && (
          absentDevs.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No absentees — everyone accounted for!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/10">
              {absentDevs.map(dev => {
                const rec = records[dev.id]
                const isLoading = saving === dev.id
                return (
                  <div key={dev.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{dev.name}</p>
                      <p className="text-xs text-gray-500">{dev.employeeId} · {dev.department}{dev.team ? ` · ${dev.team}` : ''}</p>
                    </div>
                    <StatusBadge status={rec?.status ?? 'PENDING'} />
                    {isAdmin && !isCancelled && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Red: mark ABSENT */}
                        <button
                          title="Mark as Absent (no valid reason)"
                          onClick={() => markOne(dev.id, 'ABSENT')}
                          disabled={isLoading}
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                            rec?.status === 'ABSENT'
                              ? 'bg-red-600 text-white'
                              : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                          )}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {isLoading ? '…' : 'Absent'}
                        </button>
                        {/* Yellow: mark EXCUSED */}
                        <button
                          title="Mark as Excused (valid reason)"
                          onClick={() => { setExcuseTarget(dev); setExcuseReason(rec?.reason ?? '') }}
                          disabled={isLoading}
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                            rec?.status === 'EXCUSED'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                          )}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {isLoading ? '…' : 'Excused'}
                        </button>
                        {/* Green: mark PRESENT */}
                        <button
                          title="Mark as Present"
                          onClick={() => markOne(dev.id, 'PRESENT')}
                          disabled={isLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Present
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Excused section */}
      {excusedDevs.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Excused</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">{excusedDevs.length}</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/10">
            {excusedDevs.map(dev => {
              const rec = records[dev.id]
              return (
                <div key={dev.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{dev.name}</p>
                    <p className="text-xs text-gray-500">{dev.employeeId}</p>
                    {rec?.reason && <p className="text-xs text-yellow-700 mt-0.5 italic">"{rec.reason}"</p>}
                  </div>
                  {isAdmin && !isCancelled && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => markOne(dev.id, 'ABSENT')}
                        disabled={saving === dev.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Absent
                      </button>
                      <button
                        onClick={() => markOne(dev.id, 'PRESENT')}
                        disabled={saving === dev.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Present
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Present section (collapsible) */}
      <div className="card">
        <button
          className="w-full px-5 py-4 flex items-center justify-between"
          onClick={() => setShowPresent(v => !v)}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Present</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{presentDevs.length}</span>
          </div>
          {showPresent ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showPresent && (
          presentDevs.length === 0 ? (
            <div className="px-5 pb-5 text-sm text-gray-400">No one marked as present yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/10">
              {presentDevs.map(dev => (
                <div key={dev.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{dev.name}</p>
                    <p className="text-xs text-gray-500">{dev.employeeId} · {dev.department}</p>
                  </div>
                  <StatusBadge status="PRESENT" />
                  {isAdmin && !isCancelled && (
                    <button
                      onClick={() => markOne(dev.id, 'ABSENT')}
                      disabled={saving === dev.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Mark Absent
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Excuse reason modal */}
      {excuseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Excuse Absence</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Provide a valid reason for <strong>{excuseTarget.name}</strong>'s absence.
            </p>
            <input
              type="text"
              placeholder="e.g. Medical leave, client visit…"
              value={excuseReason}
              onChange={e => setExcuseReason(e.target.value)}
              className="input w-full"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirmExcuse()}
            />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => { setExcuseTarget(null); setExcuseReason('') }}>Cancel</button>
              <button
                className="px-3 py-1.5 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                onClick={confirmExcuse}
                disabled={saving === excuseTarget.id}
              >
                {saving === excuseTarget.id ? 'Saving…' : 'Mark Excused'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
