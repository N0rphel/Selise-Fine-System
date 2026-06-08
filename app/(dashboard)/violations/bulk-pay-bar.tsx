'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, Wallet } from 'lucide-react'
import { formatCHF } from '@/lib/utils'

interface PayableFine {
  id: string
  project: string
  total: number
  rules: string[]
}

interface FinanceAccount {
  accountName: string
  accountNumber: string
  bankName: string | null
  qrCodeBase64: string | null
}

interface Props {
  fines: PayableFine[]
  financeAccounts: FinanceAccount[]
}

export function BulkPayBar({ fines, financeAccounts }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(fines.map(f => f.id)))
  const [screenshot, setScreenshot] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  if (fines.length === 0) return null

  const totalDue = fines.reduce((s, f) => s + f.total, 0)
  const selectedTotal = fines.filter(f => selected.has(f.id)).reduce((s, f) => s + f.total, 0)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) { setError('Screenshot must be PNG or JPG'); return }
    const reader = new FileReader()
    reader.onload = () => setScreenshot(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function submit() {
    if (selected.size === 0) { setError('Select at least one fine'); return }
    if (!screenshot) { setError('Please attach a payment screenshot'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ violationIds: Array.from(selected), screenshotBase64: screenshot, reference, note }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setOpen(false)
      router.refresh()
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <>
      {/* Banner */}
      <div className="card p-4 flex items-center justify-between gap-4 border-l-4 border-l-red-500">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              You have {fines.length} unpaid fine{fines.length > 1 ? 's' : ''} totaling{' '}
              <span className="text-red-600 font-semibold">{formatCHF(totalDue)}</span>
            </p>
            <p className="text-xs text-gray-500">Pay them all at once with a single payment proof.</p>
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary shrink-0">
          <Wallet className="w-4 h-4" /> Pay Fines
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Pay Fines</h2>
              <button onClick={() => setOpen(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            {/* Fine selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Select fines to pay</label>
                <button
                  onClick={() => setSelected(selected.size === fines.length ? new Set() : new Set(fines.map(f => f.id)))}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {selected.size === fines.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {fines.map(f => (
                  <label key={f.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${selected.has(f.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} className="accent-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{f.project}</p>
                      <p className="text-xs text-gray-400 truncate">{f.rules.join(', ')}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-600 shrink-0">{formatCHF(f.total)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">{selected.size} fine{selected.size !== 1 ? 's' : ''} selected</span>
              <span className="text-lg font-bold text-red-600">{formatCHF(selectedTotal)}</span>
            </div>

            {/* Where to pay */}
            {financeAccounts.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                <p className="font-medium text-gray-700">Pay to:</p>
                {financeAccounts.map((a, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-gray-800">{a.accountName}</p>
                      <p className="font-mono">{a.accountNumber}{a.bankName ? ` · ${a.bankName}` : ''}</p>
                    </div>
                    {a.qrCodeBase64 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.qrCodeBase64} alt="QR" className="w-16 h-16 object-contain border border-gray-200 rounded ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Proof */}
            <div>
              <label className="label">Payment Screenshot *</label>
              {screenshot ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={screenshot} alt="Proof" className="w-full rounded-lg border border-gray-200" />
                  <button onClick={() => setScreenshot('')} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow border border-gray-200"><X className="w-3.5 h-3.5 text-gray-600" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-600">
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
              <button onClick={submit} disabled={loading || selected.size === 0} className="btn-primary flex-1">
                {loading ? 'Submitting…' : `Submit Payment · ${formatCHF(selectedTotal)}`}
              </button>
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
