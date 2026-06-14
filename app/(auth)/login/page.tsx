'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Github } from 'lucide-react'
import { MomoIcon } from '@/components/momo-icon'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function handleGithub() {
    setLoading(true)
    await signIn('github', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <MomoIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SELISE Fine System</h1>
          <p className="text-slate-400 text-sm mt-1">PR Fine &amp; Review Management</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
            <p className="text-sm text-gray-500 mt-0.5">Continue with your GitHub account to join as a developer.</p>
          </div>

          <button
            onClick={handleGithub}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Github className="w-5 h-5" />
            {loading ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
          </button>

          <div className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-4">
            <p>First sign-in creates your developer profile automatically. An admin can grant additional roles (Finance, PR Captain) afterwards in User Management.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
