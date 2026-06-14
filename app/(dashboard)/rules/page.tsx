import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'
import { getUserTeamMemberships, captainTeamIds } from '@/lib/team-auth'
import { db } from '@/lib/db'
import { RulesClient } from './rules-client'

export default async function RulesPage() {
  const session = await auth()
  const user = session!.user as any
  const admin = isAdmin(user.permissions ?? [])

  const memberships = await getUserTeamMemberships(user.developerId)
  const myCaptainTeamIds = admin ? [] : captainTeamIds(memberships)

  const [rules, captainTeams] = await Promise.all([
    db.violationRule.findMany({
      where: { deletedAt: null },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
      include: {
        _count: { select: { items: true } },
        team: { select: { name: true, slug: true } },
      },
    }),
    // Teams this captain can manage rules for
    myCaptainTeamIds.length > 0
      ? db.team.findMany({ where: { id: { in: myCaptainTeamIds }, deletedAt: null }, select: { id: true, name: true, slug: true } })
      : [],
  ])

  return (
    <RulesClient
      rules={rules}
      isAdmin={admin}
      captainTeams={captainTeams}
    />
  )
}
