import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { getUserTeamMemberships } from '@/lib/team-auth'
import { Landmark, Info } from 'lucide-react'

export default async function PaymentDetailsPage() {
  const session = await auth()
  const user = session!.user as any
  const permissions: string[] = user.permissions ?? ['DEVELOPER']
  const admin = isAdmin(permissions) || canViewFinance(permissions)

  // For developers, show only the accounts for their teams
  let accounts: { id: string; accountName: string; accountNumber: string; bankName: string | null; notes: string | null; qrCodeBase64: string | null; teamId: string | null; team?: { name: string; slug: string } | null }[] = []

  if (admin) {
    accounts = await db.financeAccount.findMany({
      orderBy: { createdAt: 'asc' },
      include: { team: { select: { name: true, slug: true } } },
    })
  } else {
    const memberships = await getUserTeamMemberships(user.developerId)
    const teamIds = memberships.map(m => m.teamId)
    if (teamIds.length > 0) {
      accounts = await db.financeAccount.findMany({
        where: { teamId: { in: teamIds } },
        orderBy: { createdAt: 'asc' },
        include: { team: { select: { name: true, slug: true } } },
      })
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="page-title">Payment Details</h1>
        <p className="text-sm text-gray-500 mt-0.5">Use these account details to pay your fines</p>
      </div>

      {accounts.length === 0 ? (
        <div className="card p-12 text-center">
          <Landmark className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No payment account has been set up for your team yet.</p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              Pay your approved fines to the account below. Reference your name and PR link in the payment description.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map(a => (
              <div key={a.id} className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Landmark className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{a.accountName}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {a.team && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{a.team.slug}</span>
                      )}
                      {a.bankName && <p className="text-xs text-gray-500">{a.bankName}</p>}
                    </div>
                  </div>
                </div>

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Account No.</dt>
                    <dd className="font-mono font-medium text-gray-900">{a.accountNumber}</dd>
                  </div>
                  {a.notes && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-gray-500 text-xs">{a.notes}</p>
                    </div>
                  )}
                </dl>

                {a.qrCodeBase64 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col items-center">
                    <p className="text-xs text-gray-400 mb-2">Scan to pay</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.qrCodeBase64} alt="Payment QR Code" className="w-40 h-40 object-contain border border-gray-200 rounded-lg p-1" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
