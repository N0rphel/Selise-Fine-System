import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds, allMemberTeamIds } from '@/lib/team-auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { formatCHF, formatDateTime, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { ExternalLink, ArrowLeft, MessageSquare } from 'lucide-react'
import { ViolationActions } from './violation-actions'
import { PaymentPanel } from './payment-panel'

export default async function ViolationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']
  const admin = isAdmin(permissions)
  const finance = canViewFinance(permissions)

  const { id: violationId } = await params
  const v = await db.violationReport.findUnique({
    where: { id: violationId },
    include: {
      developer: true,
      project: true,
      reporter: true,
      approver: true,
      items: { include: { rule: true } },
      auditLogs: { include: { user: true }, orderBy: { createdAt: 'desc' } },
      payment: true,
    },
  })

  if (!v || v.deletedAt) notFound()

  const memberships = await getUserTeamMemberships(user.developerId)
  const myCaptainTeams = captainTeamIds(memberships)
  const myAllTeams     = allMemberTeamIds(memberships)
  const isCaptainForViolation = myCaptainTeams.length > 0 && !!(
    await db.teamMember.findFirst({ where: { developerId: v.developerId, teamId: { in: myCaptainTeams } } })
  )

  // Access control: admin & finance see all; captain sees their team; developer sees own or teammates'
  const isOwnViolation = !!user.developerId && v.developerId === user.developerId
  let isTeammateViolation = false
  if (!admin && !finance && !isCaptainForViolation && !isOwnViolation && myAllTeams.length > 0) {
    const shared = await db.teamMember.findFirst({
      where: { developerId: v.developerId, teamId: { in: myAllTeams } },
    })
    isTeammateViolation = !!shared
  }

  if (!admin && !finance && !isCaptainForViolation && !isOwnViolation && !isTeammateViolation) notFound()

  // Show team-specific finance account (or global fallback) when developer needs to pay
  const financeAccounts = isOwnViolation && v.status === 'APPROVED'
    ? await db.financeAccount.findMany({
        where: {
          OR: [
            { teamId: null },
            { team: { members: { some: { developerId: v.developerId } } } },
          ],
        },
        orderBy: { createdAt: 'asc' },
      })
    : []

  const canApprove = admin || isCaptainForViolation
  const canSubmit = (admin || isCaptainForViolation) && v.status === 'DRAFT'

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/violations" className="btn-ghost py-1.5 px-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="page-title">Violation Detail</h1>
          <p className="text-xs text-gray-500 mt-0.5">ID: {v.id}</p>
        </div>
        <span className={`badge ml-auto ${STATUS_COLORS[v.status]}`}>{STATUS_LABELS[v.status]}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Basic info */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Violation Information</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Developer', v.developer.name],
                ['Project', v.project.name],
                ['Reported By', v.reporter.name],
                ['Approved By', v.approver?.name ?? '—'],
                ['Date', formatDateTime(v.createdAt)],
                ['Last Updated', formatDateTime(v.updatedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
                  <dd className="text-gray-900 mt-0.5 font-medium">{value}</dd>
                </div>
              ))}
              <div className="col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">PR Link</dt>
                <dd className="mt-0.5">
                  <a href={v.prLink} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {v.prLink}
                  </a>
                </dd>
              </div>
              {v.evidenceImages.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Evidence</dt>
                  <dd className="grid grid-cols-3 gap-2">
                    {v.evidenceImages.map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                        <img
                          src={img}
                          alt={`Evidence ${i + 1}`}
                          className="w-full aspect-square object-cover rounded-lg hover:opacity-80 transition-opacity cursor-zoom-in"
                        />
                      </a>
                    ))}
                  </dd>
                </div>
              )}
              {v.rejectionNote && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-red-500 uppercase tracking-wider">Rejection Reason</dt>
                  <dd className="mt-0.5 text-red-700 bg-red-50 rounded-lg p-3 text-sm">{v.rejectionNote}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Rules breakdown */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Violation Rules Breakdown</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Code</th>
                  <th className="table-th">Category</th>
                  <th className="table-th">Description</th>
                  <th className="table-th">Unit Fine</th>
                  <th className="table-th">Qty</th>
                  <th className="table-th text-right pr-5">Total</th>
                </tr>
              </thead>
              <tbody>
                {v.items.map(item => (
                  <tr key={item.id} className="table-row">
                    <td className="table-td font-mono text-sm font-medium">{item.rule.code}</td>
                    <td className="table-td">
                      <span className="badge bg-gray-100 text-gray-600 ring-gray-200">{item.rule.category}</span>
                    </td>
                    <td className="table-td text-xs max-w-[220px]">
                      <span className="text-gray-500">{item.rule.description}</span>
                      {item.notes && (
                        <span className="mt-1.5 flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 text-amber-800">
                          <MessageSquare className="w-3 h-3 shrink-0 mt-0.5 text-amber-500" />
                          <span className="leading-relaxed">{item.notes}</span>
                        </span>
                      )}
                    </td>
                    <td className="table-td">{formatCHF(item.rule.fineAmount)}</td>
                    <td className="table-td">{item.multiplier}</td>
                    <td className="table-td font-semibold text-right pr-5">{formatCHF(item.fineAmount)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td colSpan={5} className="table-td font-semibold text-right">Total Fine</td>
                  <td className="table-td font-bold text-red-600 text-right pr-5">{formatCHF(v.totalFine)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Audit trail */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Audit Trail</h2>
            {v.auditLogs.length === 0 ? (
              <p className="text-sm text-gray-400">No audit entries yet</p>
            ) : (
              <ol className="space-y-3">
                {v.auditLogs.map(log => (
                  <li key={log.id} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-medium text-gray-900">{log.action}</span>
                      <span className="text-gray-500"> by {log.user.name}</span>
                      {log.details && <p className="text-gray-500 text-xs mt-0.5">{log.details}</p>}
                      <p className="text-gray-400 text-xs mt-0.5">{formatDateTime(log.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Right: actions + payment */}
        <div className="space-y-5">
          <ViolationActions
            violationId={v.id}
            status={v.status}
            canApprove={canApprove}
            canSubmit={canSubmit}
          />

          {v.status === 'APPROVED' && (
            <PaymentPanel
              violationId={v.id}
              amount={v.totalFine}
              payment={v.payment ? {
                status: v.payment.status,
                reference: v.payment.reference,
                note: v.payment.note,
                screenshotBase64: v.payment.screenshotBase64,
                rejectionNote: v.payment.rejectionNote,
                submittedAt: v.payment.submittedAt.toISOString(),
              } : null}
              canSubmit={isOwnViolation}
              financeAccounts={financeAccounts.map(a => ({
                accountName: a.accountName,
                accountNumber: a.accountNumber,
                bankName: a.bankName,
                qrCodeBase64: a.qrCodeBase64,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  )
}
