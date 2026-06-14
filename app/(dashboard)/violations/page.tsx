import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, reporterTeamIds, visibleTeamIds } from '@/lib/team-auth'
import { formatCHF, formatDate, STATUS_COLORS, STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { Plus, ExternalLink } from 'lucide-react'
import { ViolationsFilter } from './violations-filter'
import { BulkPayBar } from './bulk-pay-bar'

interface Props { searchParams: Promise<{ status?: string; projectId?: string; teamId?: string }> }

export default async function ViolationsPage({ searchParams }: Props) {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']

  const { status, projectId, teamId: teamFilter } = await searchParams
  const admin = isAdmin(permissions)

  const memberships = await getUserTeamMemberships(user.developerId)
  const myReporterTeams = reporterTeamIds(memberships)
  const myVisibleTeams  = visibleTeamIds(memberships)
  const canReport = admin || myReporterTeams.length > 0

  const where: any = { deletedAt: null }

  if (admin) {
    // Admin sees all; optional teamId filter narrows by teamId directly
    if (teamFilter) where.teamId = teamFilter
  } else if (myVisibleTeams.length > 0) {
    // CAPTAIN / REPORTER / FINANCE — see only violations tagged to their visible teams
    const scope = (teamFilter && myVisibleTeams.includes(teamFilter)) ? [teamFilter] : myVisibleTeams
    where.teamId = { in: scope }
  } else {
    // Plain MEMBER — own violations only
    where.developerId = user.developerId ?? '__no_linked_developer__'
  }

  if (status) where.status = status
  if (projectId) where.projectId = projectId

  // Load teams for filter tabs (non-admin multi-team users)
  const myTeamObjects = (!admin && myVisibleTeams.length > 1)
    ? await db.team.findMany({
        where: { id: { in: myVisibleTeams }, deletedAt: null },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      })
    : []

  const [violations, projects, financeAccounts] = await Promise.all([
    db.violationReport.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { developer: true, project: true, reporter: true, items: { include: { rule: true } }, payment: true },
    }),
    canReport ? db.project.findMany({ where: { active: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
    !admin ? db.financeAccount.findMany({ orderBy: { createdAt: 'asc' } }) : Promise.resolve([]),
  ])

  const payableFines = !admin
    ? violations
        .filter(v => v.developerId === (user.developerId ?? null) && v.status === 'APPROVED' && (!v.payment || v.payment.status === 'REJECTED'))
        .map(v => ({ id: v.id, project: v.project.name, total: v.totalFine, rules: v.items.map(i => i.rule.code) }))
    : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Violations</h1>
        {canReport && (
          <Link href="/violations/new" className="btn-primary">
            <Plus className="w-4 h-4" /> Report Violation
          </Link>
        )}
      </div>

      {!admin && <BulkPayBar fines={payableFines} financeAccounts={financeAccounts.map(a => ({ accountName: a.accountName, accountNumber: a.accountNumber, bankName: a.bankName, qrCodeBase64: a.qrCodeBase64 }))} />}

      {/* Team filter tabs for multi-team non-admin */}
      {myTeamObjects.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/violations"
            className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${!teamFilter ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All teams
          </Link>
          {myTeamObjects.map(t => {
            const membership = memberships.find(m => m.teamId === t.id)
            const roles = membership?.roles.filter(r => r !== 'MEMBER') ?? []
            return (
              <Link
                key={t.id}
                href={`/violations?teamId=${t.id}`}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg border transition-colors ${teamFilter === t.id ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <span className="font-bold text-xs">{t.slug}</span>
                {t.name}
                {roles.length > 0 && (
                  <span className="text-[10px] opacity-60">{roles.map(r => r[0]).join('')}</span>
                )}
              </Link>
            )
          })}
        </div>
      )}

      <div className="card">
        <ViolationsFilter projects={projects} currentStatus={status ?? ''} currentProjectId={projectId ?? ''} showProjectFilter={canReport} />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Developer</th>
                <th className="table-th">Project</th>
                <th className="table-th">PR Link</th>
                <th className="table-th">Rules</th>
                <th className="table-th">Fine</th>
                <th className="table-th">Status</th>
                <th className="table-th">Payment</th>
                <th className="table-th">Reported By</th>
                <th className="table-th">Date</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {violations.length === 0 ? (
                <tr><td colSpan={10} className="table-td text-center text-gray-400 py-10">No violations found</td></tr>
              ) : violations.map(v => (
                <tr key={v.id} className="table-row">
                  <td className="table-td font-medium text-gray-900">{v.developer.name}</td>
                  <td className="table-td">{v.project.name}</td>
                  <td className="table-td">
                    <a href={v.prLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 max-w-[140px]">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate text-xs">{v.prLink.replace('https://github.com/', '')}</span>
                    </a>
                  </td>
                  <td className="table-td">
                    <div className="flex flex-wrap gap-1">
                      {v.items.slice(0, 2).map(i => <span key={i.id} className="badge bg-gray-100 text-gray-600 ring-gray-200 text-[10px]">{i.rule.code}</span>)}
                      {v.items.length > 2 && <span className="badge bg-gray-100 text-gray-500 ring-gray-200 text-[10px]">+{v.items.length - 2}</span>}
                    </div>
                  </td>
                  <td className="table-td font-semibold text-red-600">{formatCHF(v.totalFine)}</td>
                  <td className="table-td"><span className={`badge ${STATUS_COLORS[v.status]}`}>{STATUS_LABELS[v.status]}</span></td>
                  <td className="table-td">
                    {v.status !== 'APPROVED' ? (
                      <span className="text-gray-300 text-xs">—</span>
                    ) : v.payment ? (
                      <span className={`badge ${PAYMENT_STATUS_COLORS[v.payment.status]}`}>{PAYMENT_STATUS_LABELS[v.payment.status]}</span>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-500 ring-gray-200">Unpaid</span>
                    )}
                  </td>
                  <td className="table-td text-gray-500">{v.reporter.name}</td>
                  <td className="table-td text-gray-500">{formatDate(v.createdAt)}</td>
                  <td className="table-td"><Link href={`/violations/${v.id}`} className="btn-ghost py-1 px-2 text-xs">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
