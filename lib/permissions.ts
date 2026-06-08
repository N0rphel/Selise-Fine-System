// All available permissions
export const PERMISSIONS = ['ADMIN', 'FINANCE', 'DEVELOPER'] as const
export type Permission = typeof PERMISSIONS[number]

export const PERMISSION_LABELS: Record<Permission, string> = {
  ADMIN: 'Admin / PR Owner',
  FINANCE: 'Finance Collector',
  DEVELOPER: 'Developer',
}

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  ADMIN: 'PR Owner — full control: report & approve violations, manage projects, developers, rules, assignments & users',
  FINANCE: 'View finance reports and confirm payments',
  DEVELOPER: 'Baseline — every user is a developer. View own violations & fines, submit payments',
}

// Every user is always a developer. This guarantees the baseline permission
// is present regardless of what else is granted.
export function withBaseline(permissions: string[]): string[] {
  return Array.from(new Set(['DEVELOPER', ...permissions]))
}

// Helper — ADMIN always inherits all permissions
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

export function canViewFinance(permissions: string[]): boolean {
  return has(permissions, 'FINANCE')
}

export function canManageMaster(permissions: string[]): boolean {
  return isAdmin(permissions)
}

// Sidebar visibility per permission set
export function visibleNav(permissions: string[]): string[] {
  const routes: string[] = ['/dashboard']
  if (canViewViolations(permissions)) routes.push('/violations')
  if (isAdmin(permissions)) routes.push('/projects', '/developers', '/rules', '/assignments', '/attendance')
  if (canViewFinance(permissions)) routes.push('/reports')
  if (isAdmin(permissions)) routes.push('/users')
  // Everyone can see where to pay their fines
  routes.push('/payment-details')
  return routes
}
