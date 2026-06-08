import { auth } from '@/auth'


import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { isAdmin, canViewViolations } from '@/lib/permissions'
import { formatCHF, formatDate, STATUS_COLORS, STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { Plus, ExternalLink } from 'lucide-react'
import { ViolationsFilter } from './violations-filter'
import { BulkPayBar } from './bulk-pay-bar'

interface Props { searchParams: Promise<{ status?: string; projectId?: string }> }

export default async function ViolationsPage({ searchParams }: Props) {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']

  if (!canViewViolations(permissions)) redirect('/dashboard')

  const { status, projectId } = await searchParams
  const admin = isAdmin(permissions)
  const where: any = { deletedAt: null }
  // Non-admins only ever see their own violations. If their account isn't linked
  // to a developer profile, the sentinel ensures they see nothing (not everyone's).
  if (!admin) where.developerId = user.developerId ?? '__no_linked_developer__'
  if (status) where.status = status
  if (projectId) where.projectId = projectId

  const [violations, projects, financeAccounts] = await Promise.all([
    db.violationReport.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { developer: true, project: true, reporter: true, items: { include: { rule: true } }, payment: true },
    }),
    admin ? db.project.findMany({ where: { active: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
    !admin ? db.financeAccount.findMany({ orderBy: { createdAt: 'asc' } }) : Promise.resolve([]),
  ])

  // Developer's unpaid approved fines (no payment, or a previously rejected one)
  const payableFines = !admin
    ? violations
        .filter(v => v.status === 'APPROVED' && (!v.payment || v.payment.status === 'REJECTED'))
        .map(v => ({ id: v.id, project: v.project.name, total: v.totalFine, rules: v.items.map(i => i.rule.code) }))
    : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Violations</h1>
        {admin && (
          <Link href="/violations/new" className="btn-primary">
            <Plus className="w-4 h-4" /> Report Violation
          </Link>
        )}
      </div>

      {!admin && (
        <BulkPayBar
          fines={payableFines}
          financeAccounts={financeAccounts.map(a => ({
            accountName: a.accountName, accountNumber: a.accountNumber,
            bankName: a.bankName, qrCodeBase64: a.qrCodeBase64,
          }))}
        />
      )}

      <div className="card">
        <ViolationsFilter projects={projects} currentStatus={status ?? ''} currentProjectId={projectId ?? ''} showProjectFilter={admin} />
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
