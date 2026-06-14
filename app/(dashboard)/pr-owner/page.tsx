import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { PrOwnerClient } from './pr-owner-client'

interface Props { searchParams: Promise<{ teamId?: string }> }

export default async function PrOwnerPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  const admin = isAdmin(user.permissions ?? [])

  const memberships = await getUserTeamMemberships(user.developerId)
  const myCaptainTeams = captainTeamIds(memberships)

  // Load teams relevant to this user
  const teamsWhere = admin
    ? { deletedAt: null }
    : { id: { in: memberships.map(m => m.teamId) }, deletedAt: null }

  const teams = await db.team.findMany({
    where: teamsWhere,
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  })

  if (teams.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="page-title">PR Captain Rotation</h1>
        <div className="card p-12 text-center text-gray-400 text-sm">
          {admin ? 'No teams exist yet.' : 'You are not assigned to any team.'}
        </div>
      </div>
    )
  }

  const { teamId: selectedTeamId } = await searchParams
  const activeTeamId = (selectedTeamId && teams.find(t => t.id === selectedTeamId))
    ? selectedTeamId
    : teams[0].id

  const activeTeam = teams.find(t => t.id === activeTeamId)!
  const canRotate = admin || myCaptainTeams.includes(activeTeamId)

  // Load team members who have user accounts (rotation candidates)
  const teamMembersWithUsers = await db.teamMember.findMany({
    where: { teamId: activeTeamId },
    include: {
      developer: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  })
  const teamUsers = teamMembersWithUsers
    .map(m => m.developer.user)
    .filter((u): u is NonNullable<typeof u> => u !== null)

  // Rotations for this team
  const rotations = await db.prOwnerRotation.findMany({
    where: { teamId: activeTeamId },
    orderBy: { startedAt: 'desc' },
    include: { user: true, rotatedBy: true },
  })

  const now = new Date()
  const activeRotation = rotations.find(r => r.endedAt === null) ?? null

  const userStats = teamUsers.map(u => {
    const mine = rotations.filter(r => r.userId === u.id)
    const count = mine.length
    const totalMs = mine.reduce((sum, r) => {
      return sum + ((r.endedAt ?? now).getTime() - r.startedAt.getTime())
    }, 0)
    return { userId: u.id, name: u.name, avatarUrl: u.avatarUrl, count, totalMs }
  })

  const current = activeRotation ? {
    userId:    activeRotation.userId,
    userName:  activeRotation.user.name,
    userAvatar: activeRotation.user.avatarUrl,
    startedAt:  activeRotation.startedAt.toISOString(),
    durationMs: now.getTime() - activeRotation.startedAt.getTime(),
  } : null

  const history = rotations.map((r, _i) => ({
    id:           r.id,
    userId:       r.userId,
    userName:     r.user.name,
    userAvatar:   r.user.avatarUrl,
    startedAt:    r.startedAt.toISOString(),
    endedAt:      r.endedAt?.toISOString() ?? null,
    rotatedByName: r.rotatedBy.name,
    durationMs:   (r.endedAt ?? now).getTime() - r.startedAt.getTime(),
  }))

  return (
    <PrOwnerClient
      teams={teams}
      activeTeamId={activeTeamId}
      activeTeamName={activeTeam.name}
      current={current}
      history={history}
      userStats={userStats}
      teamUsers={teamUsers.map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }))}
      currentUserId={user.id}
      canRotate={canRotate}
    />
  )
}
