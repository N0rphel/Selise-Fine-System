'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, CheckCircle, Clock, XCircle, Landmark, CreditCard } from 'lucide-react'
import { formatCHF, formatDateTime, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '@/lib/utils'

interface PaymentInfo {
  status: string
  reference: string | null
  note: string | null
  screenshotBase64: string | null
  rejectionNote: string | null
  submittedAt: string
}

interface FinanceAccount {
  accountName: string
  accountNumber: string
  bankName: string | null
  qrCodeBase64: string | null
}

interface Props {
  violationId: string
  amount: number
  payment: PaymentInfo | null
  canSubmit: boolean
  financeAccounts: FinanceAccount[]
}

export function PaymentPanel({ violationId, amount, payment, canSubmit, financeAccounts }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [reference, setReference] = useState(payment?.reference ?? '')
  const [note, setNote] = useState(payment?.note ?? '')
  const [screenshot, setScreenshot] = useState<string>(payment?.screenshotBase64 ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const confirmed = payment?.status === 'CONFIRMED'
  const submitted = payment?.status === 'SUBMITTED'
  const rejected = payment?.status === 'REJECTED'

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setError('Screenshot must be PNG or JPG'); return
    }
    const reader = new FileReader()
    reader.onload = () => setScreenshot(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function submit() {
    if (!screenshot) { setError('Please attach a payment screenshot'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ violationIds: [violationId], screenshotBase64: screenshot, reference, note }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setShowForm(false)
      router.refresh()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  // ── Confirmed state ──
  if (confirmed) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold text-gray-900">Payment Confirmed</h2>
        </div>
        <p className="text-sm text-gray-600">This fine of <span className="font-semibold text-gray-900">{formatCHF(amount)}</span> has been paid and confirmed by finance.</p>
        {payment?.reference && <p className="text-xs text-gray-400 mt-2">Reference: {payment.reference}</p>}
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-400" />
          Payment
        </h2>
        {payment && (
          <span className={`badge ${PAYMENT_STATUS_COLORS[payment.status]}`}>
            {PAYMENT_STATUS_LABELS[payment.status]}
          </span>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-500">Amount Due</p>
        <p className="text-xl font-bold text-red-600">{formatCHF(amount)}</p>
      </div>

      {/* Submitted — awaiting finance confirmation */}
      {submitted && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            <Clock className="w-4 h-4 shrink-0" />
            Awaiting finance confirmation
          </div>
          {payment?.reference && <p className="text-xs text-gray-500">Reference: <span className="text-gray-700">{payment.reference}</span></p>}
          {payment?.screenshotBase64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payment.screenshotBase64} alt="Payment proof" className="w-full rounded-lg border border-gray-200" />
          )}
          {canSubmit && (
            <button onClick={() => setShowForm(true)} className="btn-secondary w-full text-sm">Resubmit proof</button>
          )}
        </div>
      )}

      {/* Rejected — developer can resubmit */}
      {rejected && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Payment rejected by finance</p>
              {payment?.rejectionNote && <p className="text-xs mt-0.5">{payment.rejectionNote}</p>}
            </div>
          </div>
          {canSubmit && (
            <button onClick={() => setShowForm(true)} className="btn-primary w-full">Resubmit Payment Proof</button>
          )}
        </div>
      )}

      {/* No payment yet — developer submits */}
      {!payment && canSubmit && !showForm && (
        <button onClick={() => setShowForm(true)} className="btn-primary w-full">
          <Upload className="w-4 h-4" /> Submit Payment Proof
        </button>
      )}

      {/* Where to pay (developer) */}
      {canSubmit && financeAccounts.length > 0 && !confirmed && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <Landmark className="w-3.5 h-3.5" /> Pay to
          </p>
          {financeAccounts.map((a, i) => (
            <div key={i} className="text-xs text-gray-600 space-y-0.5 mb-2">
              <p className="font-medium text-gray-800">{a.accountName}</p>
              <p className="font-mono">{a.accountNumber}{a.bankName ? ` · ${a.bankName}` : ''}</p>
              {a.qrCodeBase64 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.qrCodeBase64} alt="QR" className="w-24 h-24 object-contain border border-gray-200 rounded mt-1" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Not the owner & no payment */}
      {!payment && !canSubmit && (
        <p className="text-xs text-gray-400 text-center">No payment submitted yet.</p>
      )}

      {/* Submission form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Submit Payment Proof</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Amount Due</p>
              <p className="text-lg font-bold text-red-600">{formatCHF(amount)}</p>
            </div>

            <div>
              <label className="label">Payment Screenshot *</label>
              {screenshot ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={screenshot} alt="Payment proof" className="w-full rounded-lg border border-gray-200" />
                  <button onClick={() => setScreenshot('')} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border border-gray-200">
                    <X className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-600">
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Upload payment screenshot (PNG/JPG)</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={handleUpload} className="hidden" />
            </div>

            <div>
              <label className="label">Payment Reference</label>
              <input value={reference} onChange={e => setReference(e.target.value)} className="input" placeholder="Transaction ID / reference" />
            </div>
            <div>
              <label className="label">Note</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="input resize-none" placeholder="Optional note for finance…" />
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3">
              <button onClick={submit} disabled={loading} className="btn-primary flex-1">{loading ? 'Submitting…' : 'Submit Proof'}</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {error && !showForm && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
