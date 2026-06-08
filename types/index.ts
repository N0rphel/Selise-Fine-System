export type Role = 'DEVELOPER' | 'FINANCE' | 'ADMIN'
export type ViolationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
export type CycleStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  developerId?: string | null
}
