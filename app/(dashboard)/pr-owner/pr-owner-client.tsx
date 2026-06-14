'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RotateCcw, User, Crown, Shuffle, TrendingDown, Clock, ChevronRight } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

type Method = 'random' | 'least-rotations' | 'shortest-duration' | 'manual'

interface Team { id: string; name: string; slug: string }
interface CurrentOwner { userId: string; userName: string; userAvatar: string | null; startedAt: string; durationMs: number }
interface HistoryEntry { id: string; userId: string; userName: string; userAvatar: string | null; startedAt: string; endedAt: string | null; rotatedByName: string; durationMs: number }
interface UserStat { userId: string; name: string; avatarUrl: string | null; count: number; totalMs: number }
interface SimpleUser { id: string; name: string; avatarUrl: string | null }

interface Props {
  teams: Team[]
  activeTeamId: string
  activeTeamName: string
  current: CurrentOwner | null
  history: HistoryEntry[]
  userStats: UserStat[]
  teamUsers: SimpleUser[]
  currentUserId: string
  canRotate: boolean
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0h'
  const days  = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}

const METHOD_CONFIG: Record<Method, { label: string; description: string; icon: React.ElementType }> = {
  random:              { label: 'Random',            description: 'Pick a random team member',                icon: Shuffle },
  'least-rotations':   { label: 'Fewest Rotations',  description: 'Whoever has been captain the least times', icon: TrendingDown },
  'shortest-duration': { label: 'Shortest Duration', description: 'Whoever has served the least total time',  icon: Clock },
  manual:              { label: 'Manual',             description: 'Choose a specific team member',            icon: User },
}

export function PrOwnerClient({ teams, activeTeamId, activeTeamName, current, history, userStats, teamUsers, currentUserId, canRotate }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [method, setMethod] = useState<Method>('random')
  const [manualUserId, setManualUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const candidate = useMemo((): SimpleUser | null => {
    const pool = teamUsers.filter(u => u.id !== current?.userId)
    if (!pool.length) return null
    if (method === 'manual') return teamUsers.find(u => u.id === manualUserId) ?? null
    if (method === 'random') return null

    const stats = pool.map(u => {
      const s = userStats.find(x => x.userId === u.id)
      return { user: u, count: s?.count ?? 0, totalMs: s?.totalMs ?? 0 }
    })
    if (method === 'least-rotations') {
      const min = Math.min(...stats.map(s => s.count))
      const tied = stats.filter(s => s.count === min)
      return tied.length === 1 ? tied[0].user : null
    }
    const min = Math.min(...stats.map(s => s.totalMs))
    const tied = stats.filter(s => s.totalMs === min)
    return tied.length === 1 ? tied[0].user : null
  }, [method, manualUserId, teamUsers, userStats, current])

  async function rotate() {
    if (method === 'manual' && !manualUserId) { setError('Select a team member'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/pr-owner-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, teamId: activeTeamId, userId: method === 'manual' ? manualUserId : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Rotation failed')
      setShowModal(false)
      router.refresh()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const sortedStats = [...userStats].sort((a, b) => b.count - a.count || b.totalMs - a.totalMs)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">PR Captain Rotation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track who is the current PR review captain per team</p>
        </div>
        {canRotate && (
          <button onClick={() => { setShowModal(true); setError(''); setManualUserId('') }} className="btn-primary">
            <RotateCcw className="w-4 h-4" /> Rotate Captain
          </button>
        )}
      </div>

      {/* Team tabs */}
      {teams.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {teams.map(t => (
            <Link
              key={t.id}
              href={`/pr-owner?teamId=${t.id}`}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg border transition-colors ${t.id === activeTeamId ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <span className="text-xs font-bold">{t.slug}</span>
              {t.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Current captain card */}
        <div className="card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-500" />
            <h2 className="font-semibold text-gray-900">Current PR Captain</h2>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 ml-auto">{teams.find(t => t.id === activeTeamId)?.slug}</span>
          </div>
          {current ? (
            <>
              <div className="flex items-center gap-3">
                {current.userAvatar ? (
                  <img src={current.userAvatar} alt={current.userName} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Crown className="w-6 h-6 text-yellow-500" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{current.userName}</p>
                  <p className="text-xs text-gray-500">Since {formatDate(current.startedAt)}</p>
                  {current.userId === currentUserId && (
                    <span className="badge bg-yellow-100 text-yellow-700 ring-yellow-200 text-[10px] mt-1">That&apos;s you!</span>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900">{formatDuration(current.durationMs)}</p>
                  <p className="text-xs text-gray-500">Current tenure</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {userStats.find(s => s.userId === current.userId)?.count ?? 1}
                  </p>
                  <p className="text-xs text-gray-500">Total rotations</p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-gray-400">No PR captain assigned yet</p>
              {canRotate && (
                <button onClick={() => setShowModal(true)} className="mt-2 text-xs text-blue-600 hover:underline">
                  Assign first captain →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Rotation Stats
              <span className="ml-2 text-xs font-normal text-gray-500">{activeTeamName}</span>
            </h2>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Member</th>
                <th className="table-th text-right pr-5">Rotations</th>
                <th className="table-th text-right pr-5">Total Duration</th>
              </tr>
            </thead>
            <tbody>
              {sortedStats.length === 0 ? (
                <tr><td colSpan={3} className="table-td text-center text-gray-400 py-8">No rotation history yet</td></tr>
              ) : sortedStats.map(s => (
                <tr key={s.userId} className={`table-row ${s.userId === current?.userId ? 'bg-yellow-50/60' : ''}`}>
                  <td className="table-td">
                    <div className="flex items-center gap-2.5">
                      {s.avatarUrl ? (
                        <img src={s.avatarUrl} alt={s.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900">{s.name}</span>
                      {s.userId === current?.userId && (
                        <span className="badge bg-yellow-100 text-yellow-700 ring-yellow-200 text-[10px]">current</span>
                      )}
                    </div>
                  </td>
                  <td className="table-td text-right pr-5 font-semibold text-gray-900">{s.count}</td>
                  <td className="table-td text-right pr-5 text-gray-600">{s.count > 0 ? formatDuration(s.totalMs) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            Rotation History
            <span className="ml-2 text-xs font-normal text-gray-500">{activeTeamName}</span>
          </h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">#</th>
              <th className="table-th">PR Captain</th>
              <th className="table-th">Started</th>
              <th className="table-th">Ended</th>
              <th className="table-th">Duration</th>
              <th className="table-th">Rotated By</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={6} className="table-td text-center text-gray-400 py-10">No rotations yet for {activeTeamName}</td></tr>
            ) : history.map((r, i) => (
              <tr key={r.id} className="table-row">
                <td className="table-td text-gray-400 text-xs">{history.length - i}</td>
                <td className="table-td">
                  <div className="flex items-center gap-2">
                    {r.userAvatar
                      ? <img src={r.userAvatar} alt={r.userName} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      : <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><User className="w-3 h-3 text-gray-400" /></div>
                    }
                    <span className="font-medium text-gray-900">{r.userName}</span>
                    {!r.endedAt && <span className="badge bg-yellow-100 text-yellow-700 ring-yellow-200 text-[10px]">active</span>}
                  </div>
                </td>
                <td className="table-td text-gray-600 text-sm">{formatDateTime(r.startedAt)}</td>
                <td className="table-td text-gray-600 text-sm">{r.endedAt ? formatDateTime(r.endedAt) : <span className="text-gray-300">—</span>}</td>
                <td className="table-td font-medium text-gray-900">{formatDuration(r.durationMs)}</td>
                <td className="table-td text-gray-500 text-sm">{r.rotatedByName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rotate modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div>
              <h2 className="font-semibold text-gray-900">Rotate PR Captain</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {current
                  ? `Rotating from ${current.userName} · ${activeTeamName}`
                  : `Assign first captain for ${activeTeamName}`}
              </p>
            </div>

            <div>
              <label className="label mb-2">Selection Method</label>
              <div className="space-y-2">
                {(Object.entries(METHOD_CONFIG) as [Method, (typeof METHOD_CONFIG)[Method]][]).map(([m, cfg]) => (
                  <label key={m}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${method === m ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="method" value={m} checked={method === m} onChange={() => { setMethod(m); setManualUserId('') }} className="accent-blue-600" />
                    <cfg.icon className="w-4 h-4 text-gray-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{cfg.label}</p>
                      <p className="text-xs text-gray-500">{cfg.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {method === 'manual' && (
              <div>
                <label className="label">Team Member</label>
                <select value={manualUserId} onChange={e => setManualUserId(e.target.value)} className="input">
                  <option value="">Select member…</option>
                  {teamUsers.filter(u => u.id !== current?.userId).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}

            {candidate && method !== 'random' && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                <ChevronRight className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-blue-700">Will rotate to: <strong>{candidate.name}</strong></span>
              </div>
            )}
            {method === 'random' && (
              <p className="text-xs text-gray-400 text-center">Candidate will be picked randomly from team members on confirm</p>
            )}
            {(method === 'least-rotations' || method === 'shortest-duration') && !candidate && (
              <p className="text-xs text-gray-400 text-center">Multiple tied candidates — will pick randomly among them</p>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3">
              <button onClick={rotate} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Rotating…' : 'Rotate Now'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
