import { auth } from '@/auth'
import { db } from '@/lib/db'
import { formatCHF, formatDate, formatDateTime, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import Link from 'next/link'
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Plus, ClipboardList, XCircle, Users } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']

  const admin = isAdmin(permissions)
  const finance = canViewFinance(permissions)
  const isDev = permissions.includes('DEVELOPER') && !admin
  const showViolations = admin || permissions.includes('DEVELOPER')

  const where: any = { deletedAt: null }
  // Non-admins see only their own violations; unlinked accounts see none.
  if (isDev) where.developerId = user.developerId ?? '__no_linked_developer__'

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Today's date at midnight UTC for PrSession lookup
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

  const [total, approved, pending, recentViolations, monthlyFine] = await Promise.all([
    showViolations ? db.violationReport.count({ where }) : Promise.resolve(0),
    showViolations ? db.violationReport.count({ where: { ...where, status: 'APPROVED' } }) : Promise.resolve(0),
    showViolations ? db.violationReport.count({ where: { ...where, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }) : Promise.resolve(0),
    showViolations
      ? db.violationReport.findMany({ where, orderBy: { createdAt: 'desc' }, take: 8, include: { developer: true, project: true, items: { include: { rule: true } } } })
      : Promise.resolve([]),
    showViolations
      ? db.violationReport.aggregate({ where: { ...where, status: 'APPROVED', createdAt: { gte: monthStart } }, _sum: { totalFine: true } })
      : Promise.resolve({ _sum: { totalFine: 0 } }),
  ])

  // Today's PR session for the attendance widget (admin only)
  const todaySession = admin
    ? await db.prSession.findFirst({
        where: { date: todayUTC, status: 'SCHEDULED' },
        include: { attendances: { select: { status: true } } },
      })
    : null

  // "Collected" = money actually paid (payment confirmed), not just approved fines.
  const allTimeFine = finance
    ? await db.payment.aggregate({ where: { status: 'CONFIRMED' }, _sum: { amount: true } })
    : null

  const topViolators = finance
    ? await db.violationReport.groupBy({
        by: ['developerId'], where: { status: 'APPROVED', deletedAt: null },
        _sum: { totalFine: true }, orderBy: { _sum: { totalFine: 'desc' } }, take: 5,
      })
    : []

  const stats = [
    { label: 'Total Violations', value: total, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Approved', value: approved, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Pending Review', value: pending, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { label: 'Fines This Month', value: formatCHF((monthlyFine as any)._sum?.totalFine ?? 0), icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back, {user.name}</p>
        </div>
        {admin && (
          <Link href="/violations/new" className="btn-primary">
            <Plus className="w-4 h-4" /> Report Violation
          </Link>
        )}
      </div>

      {showViolations && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="stat-card flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {finance && allTimeFine && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">All-Time Fines Collected</p>
            <p className="text-3xl font-bold text-green-600">{formatCHF(allTimeFine._sum.amount ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Confirmed payments only</p>
            <Link href="/reports" className="text-xs text-blue-600 mt-2 inline-block hover:underline">View Finance Reports →</Link>
          </div>
          {topViolators.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Top Violators</p>
              <div className="space-y-2">
                {await Promise.all(topViolators.map(async (tv, i) => {
                  const dev = await db.developer.findUnique({ where: { id: tv.developerId } })
                  return (
                    <div key={tv.developerId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium">{i + 1}</span>
                        <span className="text-gray-700">{dev?.name ?? '—'}</span>
                      </div>
                      <span className="font-semibold text-red-600">{formatCHF(tv._sum.totalFine ?? 0)}</span>
                    </div>
                  )
                }))}
              </div>
            </div>
          )}
        </div>
      )}

      {showViolations && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Violations</h2>
            <Link href="/violations" className="text-sm text-blue-600 hover:text-blue-700">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Developer</th>
                  <th className="table-th">Project</th>
                  <th className="table-th">Rules</th>
                  <th className="table-th">Fine</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Date</th>
                </tr>
              </thead>
              <tbody>
                {(recentViolations as any[]).length === 0 ? (
                  <tr><td colSpan={6} className="table-td text-center text-gray-400 py-8">No violations found</td></tr>
                ) : (recentViolations as any[]).map((v: any) => (
                  <tr key={v.id} className="table-row">
                    <td className="table-td font-medium text-gray-900">{v.developer.name}</td>
                    <td className="table-td">{v.project.name}</td>
                    <td className="table-td">
                      <div className="flex flex-wrap gap-1">
                        {v.items.slice(0, 2).map((i: any) => <span key={i.id} className="badge bg-gray-100 text-gray-600 ring-gray-200">{i.rule.code}</span>)}
                        {v.items.length > 2 && <span className="badge bg-gray-100 text-gray-500 ring-gray-200">+{v.items.length - 2}</span>}
                      </div>
                    </td>
                    <td className="table-td font-medium text-red-600">{formatCHF(v.totalFine)}</td>
                    <td className="table-td"><span className={`badge ${STATUS_COLORS[v.status]}`}>{STATUS_LABELS[v.status]}</span></td>
                    <td className="table-td text-gray-500">{formatDateTime(v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance widget — admin only */}
      {admin && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-500" />
              <h2 className="font-semibold text-gray-900">Today&apos;s Attendance</h2>
            </div>
            <Link href="/attendance" className="text-sm text-blue-600 hover:text-blue-700">Manage →</Link>
          </div>
          {todaySession ? (
            <>
              <p className="text-xs text-gray-500 mb-3">{formatDate(todaySession.date)} · {todaySession.title || 'PR Session'}</p>
              <div className="flex flex-wrap gap-4">
                {[
                  { label: 'Present',  count: todaySession.attendances.filter(a => a.status === 'PRESENT').length,  color: 'text-green-600', Icon: CheckCircle },
                  { label: 'Absent',   count: todaySession.attendances.filter(a => a.status === 'ABSENT').length,   color: 'text-red-600',   Icon: XCircle },
                  { label: 'Excused',  count: todaySession.attendances.filter(a => a.status === 'EXCUSED').length,  color: 'text-yellow-600',Icon: Clock },
                  { label: 'Pending',  count: todaySession.attendances.filter(a => a.status === 'PENDING').length,  color: 'text-gray-400',  Icon: Users },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <s.Icon className={`w-4 h-4 ${s.color}`} />
                    <span className={`text-lg font-bold ${s.color}`}>{s.count}</span>
                    <span className="text-xs text-gray-500">{s.label}</span>
                  </div>
                ))}
              </div>
              <Link
                href={`/attendance/${todaySession.id}`}
                className="mt-3 inline-block text-xs text-blue-600 hover:underline"
              >
                Mark attendance →
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500 flex-1">No PR session scheduled for today.</p>
              <Link href="/attendance" className="btn-secondary text-xs py-1 px-2.5">
                <Plus className="w-3 h-3" /> Schedule
              </Link>
            </div>
          )}
        </div>
      )}

      {!showViolations && !finance && !admin && (
        <div className="card p-12 text-center">
          <p className="text-gray-400">No content available for your current permissions.</p>
        </div>
      )}
    </div>
  )
}
