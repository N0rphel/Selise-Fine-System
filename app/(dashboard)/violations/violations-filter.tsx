'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Project { id: string; name: string }

interface Props {
  projects: Project[]
  currentStatus: string
  currentProjectId: string
  showProjectFilter?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved', REJECTED: 'Rejected',
}

export function ViolationsFilter({ projects, currentStatus, currentProjectId, showProjectFilter = true }: Props) {
  const router = useRouter()

  function buildHref(status?: string, projectId?: string) {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (projectId) p.set('projectId', projectId)
    return `/violations${p.size ? '?' + p.toString() : ''}`
  }

  function onProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(buildHref(currentStatus || undefined, e.target.value || undefined))
  }

  const statuses = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']

  return (
    <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
      <Link href="/violations"
        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!currentStatus ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
        All
      </Link>
      {statuses.map(s => (
        <Link key={s} href={buildHref(s, currentProjectId || undefined)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${currentStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {STATUS_LABELS[s]}
        </Link>
      ))}
      {showProjectFilter && (
        <div className="ml-auto">
          <select
            value={currentProjectId}
            onChange={onProjectChange}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
