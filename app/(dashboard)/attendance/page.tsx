import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { AttendanceClient } from './attendance-client'

export default async function AttendancePage() {
  const session = await auth()
  const user = session!.user as any
  const admin = isAdmin(user.permissions ?? [])

  const raw = await db.prSession.findMany({
    include: { attendances: { select: { status: true } } },
  })

  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

  // Upcoming (today+): nearest first. Past: most-recent first.
  const upcoming = raw.filter(s => s.date >= todayUTC).sort((a, b) => a.date.getTime() - b.date.getTime())
  const past     = raw.filter(s => s.date <  todayUTC).sort((a, b) => b.date.getTime() - a.date.getTime())

  const serialized = [...upcoming, ...past].map(s => ({
    id:           s.id,
    date:         s.date.toISOString(),
    title:        s.title,
    status:       s.status,
    cancelNote:   s.cancelNote,
    presentCount: s.attendances.filter(a => a.status === 'PRESENT').length,
    absentCount:  s.attendances.filter(a => a.status === 'ABSENT').length,
    excusedCount: s.attendances.filter(a => a.status === 'EXCUSED').length,
    pendingCount: s.attendances.filter(a => a.status === 'PENDING').length,
    totalDevs:    s.attendances.length,
  }))

  return <AttendanceClient sessions={serialized} isAdmin={admin} />
}
