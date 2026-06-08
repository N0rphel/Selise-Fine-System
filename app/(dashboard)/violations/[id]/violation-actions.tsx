'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Send, Clock } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/utils'

interface Props {
  violationId: string
  status: string
  canApprove: boolean
  canSubmit: boolean
}

export function ViolationActions({ violationId, status, canApprove, canSubmit }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [error, setError] = useState('')

  async function post(path: string, body?: object) {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/violations/${violationId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const NEXT_STEP: Record<string, string> = {
    DRAFT: 'Submit → Under Review → Approved / Rejected',
    SUBMITTED: 'Mark Under Review → Approved / Rejected',
    UNDER_REVIEW: 'Ready to Approve or Reject',
    APPROVED: 'Fine has been posted',
    REJECTED: 'Violation closed',
  }

  const noActions = ['APPROVED', 'REJECTED'].includes(status)

  return (
    <div className="card p-5 space-y-3">
      <h2 className="font-semibold text-gray-900">Actions</h2>

      <div className="bg-gray-50 rounded-lg p-3 text-xs">
        <p className="font-medium text-gray-700">
          Status: <span className="text-gray-900">{STATUS_LABELS[status] ?? status}</span>
        </p>
        <p className="text-gray-400 mt-0.5">{NEXT_STEP[status]}</p>
      </div>

      {canSubmit && (
        <button onClick={() => post('submit')} disabled={loading} className="btn-primary w-full">
          <Send className="w-4 h-4" />
          Submit for Review
        </button>
      )}

      {canApprove && status === 'SUBMITTED' && (
        <button onClick={() => post('review')} disabled={loading} className="btn-secondary w-full">
          <Clock className="w-4 h-4" />
          Mark Under Review
        </button>
      )}

      {canApprove && ['SUBMITTED', 'UNDER_REVIEW'].includes(status) && (
        <>
          <button onClick={() => post('approve')} disabled={loading} className="btn-success w-full">
            <CheckCircle className="w-4 h-4" />
            Approve &amp; Post Fine
          </button>

          {!showReject ? (
            <button onClick={() => setShowReject(true)} disabled={loading} className="btn-danger w-full">
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rejectionNote}
                onChange={e => setRejectionNote(e.target.value)}
                rows={3}
                className="input text-sm resize-none"
                placeholder="Reason for rejection…"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => post('reject', { note: rejectionNote })}
                  disabled={loading || !rejectionNote.trim()}
                  className="btn-danger flex-1"
                >
                  Confirm Reject
                </button>
                <button onClick={() => setShowReject(false)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {noActions && (
        <p className="text-xs text-gray-400 text-center pt-1">This violation is closed.</p>
      )}
    </div>
  )
}
