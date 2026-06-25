import { db } from './db'

export type TeamMembership = { teamId: string; roles: string[] }

export async function getUserTeamMemberships(developerId: string | null | undefined): Promise<TeamMembership[]> {
  if (!developerId) return []
  return db.teamMember.findMany({
    where: { developerId },
    select: { teamId: true, roles: true },
  })
}

// Team IDs where member has CAPTAIN or REPORTER role
export function reporterTeamIds(m: TeamMembership[]): string[] {
  return m.filter(r => r.roles.includes('CAPTAIN') || r.roles.includes('REPORTER')).map(r => r.teamId)
}

// Team IDs where member has CAPTAIN role
export function captainTeamIds(m: TeamMembership[]): string[] {
  return m.filter(r => r.roles.includes('CAPTAIN')).map(r => r.teamId)
}

// Team IDs where member has any elevated role (not MEMBER-only)
export function visibleTeamIds(m: TeamMembership[]): string[] {
  return m
    .filter(r => r.roles.some(role => role !== 'MEMBER'))
    .map(r => r.teamId)
}

// Team IDs where member has FINANCE or CAPTAIN role
export function financeTeamIds(m: TeamMembership[]): string[] {
  return m.filter(r => r.roles.includes('FINANCE') || r.roles.includes('CAPTAIN')).map(r => r.teamId)
}

// All team IDs the developer belongs to (any role, including plain MEMBER)
export function allMemberTeamIds(m: TeamMembership[]): string[] {
  return m.map(r => r.teamId)
}

// All developer IDs that are members of the given teams
export async function getTeamDeveloperIds(teamIds: string[]): Promise<string[]> {
  if (!teamIds.length) return []
  const rows = await db.teamMember.findMany({
    where: { teamId: { in: teamIds } },
    select: { developerId: true },
  })
  return [...new Set(rows.map(r => r.developerId))]
}
