'use client'
import { useState, useEffect, useRef } from 'react'
import { formatCHF, formatDateTime, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '@/lib/utils'
import { BarChart3, TrendingUp, Users, Calendar, Landmark, Plus, Edit2, Trash2, Upload, X, CreditCard, CheckCircle, XCircle, Clock } from 'lucide-react'

type Tab = 'monthly' | 'developer' | 'accounts' | 'payments'

interface PaymentRow {
  id: string
  amount: number
  status: string
  reference: string | null
  note: string | null
  screenshotBase64: string | null
  rejectionNote: string | null
  submittedAt: string
  violations: {
    id: string
    prLink: string
    totalFine: number
    developer: { name: string; employeeId: string }
    project: { name: string }
  }[]
}

interface FinanceAccount {
  id: string
  accountName: string
  accountNumber: string
  bankName: string | null
  notes: string | null
  qrCodeBase64: string | null
}

const EMPTY_FORM = { accountName: '', accountNumber: '', bankName: '', notes: '', qrCodeBase64: '' }

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('monthly')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [data, setData] = useState<any>(null)
  const [devData, setDevData] = useState<any>(null)
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [actioning, setActioning] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [viewImage, setViewImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FinanceAccount | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData() }, [tab, year, month])

  async function loadData() {
    setLoading(true)
    try {
      if (tab === 'monthly') {
        const res = await fetch(`/api/reports?type=monthly&year=${year}&month=${month}`)
        if (res.ok) setData(await res.json())
      } else if (tab === 'developer') {
        const res = await fetch(`/api/reports?type=developer`)
        if (res.ok) setDevData(await res.json())
      } else if (tab === 'accounts') {
        const res = await fetch('/api/finance-account')
        if (res.ok) setAccounts(await res.json())
      } else if (tab === 'payments') {
        const res = await fetch('/api/payments')
        if (res.ok) setPayments(await res.json())
      }
    } finally { setLoading(false) }
  }

  async function confirmPayment(id: string) {
    setActioning(id)
    try {
      const res = await fetch(`/api/payments/${id}/confirm`, { method: 'POST' })
      if (res.ok) { const r = await fetch('/api/payments'); if (r.ok) setPayments(await r.json()) }
    } finally { setActioning(null) }
  }

  async function rejectPayment(id: string) {
    setActioning(id)
    try {
      const res = await fetch(`/api/payments/${id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: rejectNote }),
      })
      if (res.ok) {
        setRejectingId(null); setRejectNote('')
        const r = await fetch('/api/payments'); if (r.ok) setPayments(await r.json())
      }
    } finally { setActioning(null) }
  }

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true)
  }

  function openEdit(a: FinanceAccount) {
    setEditing(a)
    setForm({ accountName: a.accountName, accountNumber: a.accountNumber, bankName: a.bankName ?? '', notes: a.notes ?? '', qrCodeBase64: a.qrCodeBase64 ?? '' })
    setFormError('')
    setShowForm(true)
  }

  function handleQRUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setFormError('QR code must be PNG or JPG'); return
    }
    const reader = new FileReader()
    reader.onload = () => setForm(f => ({ ...f, qrCodeBase64: reader.result as string }))
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!form.accountName.trim() || !form.accountNumber.trim()) {
      setFormError('Account name and number are required'); return
    }
    setSaving(true); setFormError('')
    try {
      const url = editing ? `/api/finance-account/${editing.id}` : '/api/finance-account'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setShowForm(false)
      const updated = await fetch('/api/finance-account')
      if (updated.ok) setAccounts(await updated.json())
    } catch (e: any) { setFormError(e.message) } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this account?')) return
    await fetch(`/api/finance-account/${id}`, { method: 'DELETE' })
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i)

  const tabs = [
    { id: 'monthly' as Tab,   icon: Calendar,   label: 'Finance Per Month' },
    { id: 'developer' as Tab, icon: Users,      label: 'Finance Per Developer' },
    { id: 'payments' as Tab,  icon: CreditCard, label: 'Payment Confirmations' },
    { id: 'accounts' as Tab,  icon: Landmark,   label: 'Account Details' },
  ]

  const pendingCount = payments.filter(p => p.status === 'SUBMITTED').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Finance Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track fines and manage payment account details</p>
        </div>
        {tab === 'monthly' && (
          <div className="flex items-center gap-2">
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {tab === 'accounts' && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Account
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.id === 'payments' && pendingCount > 0 && (
              <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${tab === t.id ? 'bg-white/25 text-white' : 'bg-yellow-100 text-yellow-700'}`}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-16 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Monthly ── */}
          {tab === 'monthly' && data && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card"><p className="text-2xl font-bold text-gray-900">{formatCHF(data.grandTotal ?? 0)}</p><p className="text-xs font-medium text-gray-700 mt-0.5">Fined — {months[month-1]} {year}</p></div>
                <div className="stat-card"><p className="text-2xl font-bold text-green-600">{formatCHF(data.grandCollected ?? 0)}</p><p className="text-xs font-medium text-gray-700 mt-0.5">Collected (Paid)</p></div>
                <div className="stat-card"><p className="text-2xl font-bold text-red-600">{formatCHF((data.grandTotal ?? 0) - (data.grandCollected ?? 0))}</p><p className="text-xs font-medium text-gray-700 mt-0.5">Outstanding</p></div>
              </div>
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Monthly Fine Report — {months[month-1]} {year}</h2>
                  <BarChart3 className="w-4 h-4 text-gray-300" />
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr><th className="table-th">Employee</th><th className="table-th">Project</th><th className="table-th">Violations</th><th className="table-th text-right">Fined</th><th className="table-th text-right pr-5">Collected</th></tr>
                  </thead>
                  <tbody>
                    {!data.rows?.length
                      ? <tr><td colSpan={5} className="table-td text-center text-gray-400 py-10">No approved violations for {months[month-1]} {year}</td></tr>
                      : data.rows.map((row: any, i: number) => (
                        <tr key={i} className="table-row">
                          <td className="table-td font-medium text-gray-900">{row.developer.name}</td>
                          <td className="table-td">{row.project.name}</td>
                          <td className="table-td">{row.count}</td>
                          <td className="table-td text-right text-gray-700">{formatCHF(row.total)}</td>
                          <td className="table-td text-right pr-5 font-medium text-green-600">{formatCHF(row.collected ?? 0)}</td>
                        </tr>
                      ))}
                  </tbody>
                  {data.rows?.length > 0 && (
                    <tfoot><tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td colSpan={3} className="table-td font-semibold text-right">Grand Total</td>
                      <td className="table-td text-right font-semibold text-gray-700">{formatCHF(data.grandTotal ?? 0)}</td>
                      <td className="table-td text-right pr-5 font-bold text-green-600">{formatCHF(data.grandCollected ?? 0)}</td>
                    </tr></tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── Per Developer ── */}
          {tab === 'developer' && devData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card"><p className="text-2xl font-bold text-gray-900">{formatCHF(devData.grandTotal ?? 0)}</p><p className="text-xs font-medium text-gray-700 mt-0.5">Total Fined (All-Time)</p></div>
                <div className="stat-card"><p className="text-2xl font-bold text-green-600">{formatCHF(devData.grandCollected ?? 0)}</p><p className="text-xs font-medium text-gray-700 mt-0.5">Collected (Paid)</p></div>
                <div className="stat-card"><p className="text-2xl font-bold text-red-600">{formatCHF((devData.grandTotal ?? 0) - (devData.grandCollected ?? 0))}</p><p className="text-xs font-medium text-gray-700 mt-0.5">Outstanding</p></div>
              </div>
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Finance Per Developer — All Time</h2>
                  <TrendingUp className="w-4 h-4 text-gray-300" />
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr><th className="table-th">#</th><th className="table-th">Developer</th><th className="table-th">Department</th><th className="table-th">Violations</th><th className="table-th text-right">Fined</th><th className="table-th text-right">Collected</th><th className="table-th text-right pr-5">Outstanding</th></tr>
                  </thead>
                  <tbody>
                    {!devData.rows?.length
                      ? <tr><td colSpan={7} className="table-td text-center text-gray-400 py-10">No approved violations yet</td></tr>
                      : devData.rows.map((row: any, i: number) => {
                          const outstanding = row.total - (row.collected ?? 0)
                          return (
                            <tr key={row.developer.id} className="table-row">
                              <td className="table-td text-gray-400 text-xs w-8">{i+1}</td>
                              <td className="table-td"><p className="font-medium text-gray-900">{row.developer.name}</p><p className="text-xs text-gray-400">{row.developer.employeeId}</p></td>
                              <td className="table-td text-gray-500 text-sm">{row.developer.department}</td>
                              <td className="table-td">{row.count}</td>
                              <td className="table-td text-right text-gray-700">{formatCHF(row.total)}</td>
                              <td className="table-td text-right font-medium text-green-600">{formatCHF(row.collected ?? 0)}</td>
                              <td className={`table-td text-right pr-5 font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatCHF(outstanding)}</td>
                            </tr>
                          )
                        })}
                  </tbody>
                  {devData.rows?.length > 0 && (
                    <tfoot><tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td colSpan={4} className="table-td font-semibold text-right">Grand Total</td>
                      <td className="table-td text-right font-semibold text-gray-700">{formatCHF(devData.grandTotal ?? 0)}</td>
                      <td className="table-td text-right font-semibold text-green-600">{formatCHF(devData.grandCollected ?? 0)}</td>
                      <td className="table-td text-right pr-5 font-bold text-red-600">{formatCHF((devData.grandTotal ?? 0) - (devData.grandCollected ?? 0))}</td>
                    </tr></tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── Account Details ── */}
          {tab === 'accounts' && (
            <div className="space-y-4">
              {accounts.length === 0 ? (
                <div className="card p-12 text-center">
                  <Landmark className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No payment accounts set up yet.</p>
                  <button onClick={openCreate} className="btn-primary mt-4">
                    <Plus className="w-4 h-4" /> Add First Account
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {accounts.map(a => (
                    <div key={a.id} className="card p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">{a.accountName}</h3>
                          {a.bankName && <p className="text-xs text-gray-500 mt-0.5">{a.bankName}</p>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(a)} className="btn-ghost py-1 px-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => remove(a.id)} className="btn-ghost py-1 px-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Account No.</dt>
                          <dd className="font-mono font-medium text-gray-900">{a.accountNumber}</dd>
                        </div>
                        {a.notes && <div className="pt-2 border-t border-gray-100"><p className="text-gray-500 text-xs">{a.notes}</p></div>}
                      </dl>
                      {a.qrCodeBase64 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col items-center">
                          <p className="text-xs text-gray-400 mb-2">Payment QR Code</p>
                          <img src={a.qrCodeBase64} alt="QR Code" className="w-32 h-32 object-contain border border-gray-200 rounded-lg p-1" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Payment Confirmations ── */}
          {tab === 'payments' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card"><p className="text-2xl font-bold text-yellow-600">{payments.filter(p=>p.status==='SUBMITTED').length}</p><p className="text-xs font-medium text-gray-700 mt-0.5">Awaiting Confirmation</p></div>
                <div className="stat-card"><p className="text-2xl font-bold text-green-600">{payments.filter(p=>p.status==='CONFIRMED').length}</p><p className="text-xs font-medium text-gray-700 mt-0.5">Confirmed Paid</p></div>
                <div className="stat-card"><p className="text-2xl font-bold text-gray-900">{formatCHF(payments.filter(p=>p.status==='CONFIRMED').reduce((s,p)=>s+p.amount,0))}</p><p className="text-xs font-medium text-gray-700 mt-0.5">Total Collected</p></div>
              </div>

              {payments.length === 0 ? (
                <div className="card p-12 text-center">
                  <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No payment submissions yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map(p => (
                    <div key={p.id} className="card p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-gray-900">{p.violations[0]?.developer.name ?? '—'}</span>
                            <span className={`badge ${PAYMENT_STATUS_COLORS[p.status]}`}>{PAYMENT_STATUS_LABELS[p.status]}</span>
                            <span className="badge bg-gray-100 text-gray-600 ring-gray-200 text-[10px]">{p.violations.length} fine{p.violations.length !== 1 ? 's' : ''}</span>
                          </div>
                          <p className="text-xs text-gray-500">{p.violations[0]?.developer.employeeId}</p>
                          <p className="text-lg font-bold text-red-600 mt-1">{formatCHF(p.amount)}</p>
                          {/* Covered fines */}
                          <ul className="mt-2 space-y-0.5">
                            {p.violations.map(v => (
                              <li key={v.id} className="text-xs text-gray-500 flex items-center justify-between gap-2 max-w-sm">
                                <a href={`/violations/${v.id}`} className="text-blue-600 hover:underline truncate">{v.project.name}</a>
                                <span className="text-gray-400 shrink-0">{formatCHF(v.totalFine)}</span>
                              </li>
                            ))}
                          </ul>
                          {p.reference && <p className="text-xs text-gray-500 mt-2">Ref: <span className="text-gray-700 font-mono">{p.reference}</span></p>}
                          {p.note && <p className="text-xs text-gray-500 mt-0.5">Note: {p.note}</p>}
                          <p className="text-xs text-gray-400 mt-1">Submitted {formatDateTime(p.submittedAt)}</p>
                          {p.status === 'REJECTED' && p.rejectionNote && (
                            <p className="text-xs text-red-600 mt-2 bg-red-50 rounded px-2 py-1">Rejected: {p.rejectionNote}</p>
                          )}
                        </div>

                        {p.screenshotBase64 && (
                          <button onClick={() => setViewImage(p.screenshotBase64)} className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.screenshotBase64} alt="Payment proof" className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:ring-2 hover:ring-blue-400 transition-all" />
                          </button>
                        )}
                      </div>

                      {p.status === 'SUBMITTED' && (
                        rejectingId === p.id ? (
                          <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2} className="input text-sm resize-none" placeholder="Reason for rejection…" />
                            <div className="flex gap-2">
                              <button onClick={() => rejectPayment(p.id)} disabled={actioning === p.id} className="btn-danger flex-1 text-sm">Confirm Rejection</button>
                              <button onClick={() => { setRejectingId(null); setRejectNote('') }} className="btn-ghost text-sm">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                            <button onClick={() => confirmPayment(p.id)} disabled={actioning === p.id} className="btn-success flex-1 text-sm">
                              <CheckCircle className="w-4 h-4" /> {actioning === p.id ? 'Confirming…' : 'Confirm Payment'}
                            </button>
                            <button onClick={() => setRejectingId(p.id)} disabled={actioning === p.id} className="btn-danger text-sm">
                              <XCircle className="w-4 h-4" /> Reject
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Image lightbox */}
      {viewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setViewImage(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewImage} alt="Payment proof" className="max-w-full max-h-full rounded-lg" />
          <button onClick={() => setViewImage(null)} className="absolute top-4 right-4 bg-white rounded-full p-2 shadow"><X className="w-5 h-5" /></button>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Account' : 'Add Finance Account'}</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Account Name *</label>
                <input value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} className="input" placeholder="SELISE Digital Platforms AG" />
              </div>
              <div className="col-span-2">
                <label className="label">Account Number *</label>
                <input value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} className="input font-mono" placeholder="00-000000-0" />
              </div>
              <div>
                <label className="label">Bank Name</label>
                <input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} className="input" placeholder="PostFinance" />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="input resize-none" placeholder="Payment reference, instructions…" />
              </div>
            </div>

            {/* QR Code upload */}
            <div>
              <label className="label">QR Code <span className="text-gray-400 font-normal">(optional — PNG or JPG)</span></label>
              {form.qrCodeBase64 ? (
                <div className="flex items-center gap-4 p-3 border border-gray-200 rounded-xl">
                  <img src={form.qrCodeBase64} alt="QR preview" className="w-16 h-16 object-contain border border-gray-100 rounded-lg" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-600">QR code uploaded</p>
                    <button onClick={() => setForm(f => ({ ...f, qrCodeBase64: '' }))} className="text-xs text-red-500 hover:text-red-700 mt-1">Remove</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-600"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Click to upload QR code image</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={handleQRUpload} className="hidden" />
            </div>

            {formError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save Account'}</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
