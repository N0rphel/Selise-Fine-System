import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/permissions'
import { notFound } from 'next/navigation'
import { SessionDetailClient } from './session-detail-client'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const user = session!.user as any
  const admin = isAdmin(user.permissions ?? [])

  const prSession = await db.prSession.findUnique({
    where: { id },
    include: {
      attendances: {
        include: { developer: true },
        orderBy: { developer: { name: 'asc' } },
      },
    },
  })
  if (!prSession) notFound()

  const serialized = {
    ...prSession,
    date: prSession.date.toISOString(),
    createdAt: prSession.createdAt.toISOString(),
    updatedAt: prSession.updatedAt.toISOString(),
    attendances: prSession.attendances.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      developer: {
        ...a.developer,
        createdAt: a.developer.createdAt.toISOString(),
        updatedAt: a.developer.updatedAt.toISOString(),
        deletedAt: a.developer.deletedAt?.toISOString() ?? null,
      },
    })),
  }

  return <SessionDetailClient prSession={serialized} isAdmin={admin} />
}
