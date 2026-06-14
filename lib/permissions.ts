// User-level permissions (global scope).
// Finance access is team-scoped — granted via TeamMember.roles, not here.
// Team roles (REPORTER, CAPTAIN, FINANCE, MEMBER) live in TeamMember.roles.
export const PERMISSIONS = ['ADMIN', 'DEVELOPER'] as const
export type Permission = typeof PERMISSIONS[number]

export const PERMISSION_LABELS: Record<Permission, string> = {
  ADMIN:     'System Admin',
  DEVELOPER: 'Developer',
}

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  ADMIN:     'System-wide: manages all users, teams, projects, rules, and sees all violations.',
  DEVELOPER: 'Baseline — every user is a developer. View own violations, submit payments.',
}

export function withBaseline(permissions: string[]): string[] {
  // Strip any legacy FINANCE from system-level perms; finance is now team-scoped only
  const cleaned = permissions.filter(p => p !== 'FINANCE')
  return Array.from(new Set(['DEVELOPER', ...cleaned]))
}

export function has(permissions: string[], perm: Permission | 'ADMIN'): boolean {
  return permissions.includes('ADMIN') || permissions.includes(perm)
}

export function isAdmin(permissions: string[]): boolean {
  return permissions.includes('ADMIN')
}

export function canViewViolations(permissions: string[]): boolean {
  return has(permissions, 'DEVELOPER') || isAdmin(permissions)
}

export function canReportViolations(permissions: string[]): boolean {
  return isAdmin(permissions)
}

export function canApproveViolations(permissions: string[]): boolean {
  return isAdmin(permissions)
}

export function canManageMaster(permissions: string[]): boolean {
  return isAdmin(permissions)
}

// Global finance access = Admin only now. Team-level finance is via TeamMember.roles (FINANCE/CAPTAIN).
export function canViewFinance(permissions: string[]): boolean {
  return isAdmin(permissions)
}

// Sidebar visibility. hasTeamFinanceRole = user is FINANCE or CAPTAIN in any team.
// hasTeamCaptainRole = user is CAPTAIN in at least one team.
export function visibleNav(permissions: string[], hasTeamFinanceRole = false, hasTeamCaptainRole = false): string[] {
  // Everyone sees these
  const routes: string[] = ['/dashboard', '/violations', '/rules', '/assignments']
  // Admin-only management pages; captains also get projects + attendance
  if (isAdmin(permissions)) {
    routes.push('/projects', '/developers', '/attendance')
  } else if (hasTeamCaptainRole) {
    routes.push('/projects', '/attendance')
  }
  routes.push('/pr-owner')
  if (isAdmin(permissions) || hasTeamFinanceRole) routes.push('/reports')
  // Teams management: admin only
  if (isAdmin(permissions)) routes.push('/teams', '/users')
  routes.push('/payment-details')
  return routes
}
