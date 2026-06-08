import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Ngultrum (Nu.) — Bhutan's currency
export function formatNu(amount: number): string {
  return `Nu. ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Backward-compatible alias so existing imports keep working
export const formatCHF = formatNu

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 ring-gray-200',
  SUBMITTED: 'bg-blue-50 text-blue-700 ring-blue-200',
  UNDER_REVIEW: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  APPROVED: 'bg-green-50 text-green-700 ring-green-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: 'Developer',
  FINANCE: 'Finance Collector',
  ADMIN: 'Admin',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Payment Submitted',
  CONFIRMED: 'Paid',
  REJECTED: 'Payment Rejected',
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  CONFIRMED: 'bg-green-50 text-green-700 ring-green-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
}

export const CYCLE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 ring-gray-200',
  ACTIVE: 'bg-green-50 text-green-700 ring-green-200',
  COMPLETED: 'bg-blue-50 text-blue-700 ring-blue-200',
}

export function canApprove(role: string) {
  return role === 'ADMIN'
}

export function canReport(role: string) {
  return role === 'ADMIN'
}

export function canManageMaster(role: string) {
  return role === 'ADMIN'
}

export function canManageRules(role: string) {
  return role === 'ADMIN'
}

export function canViewFinance(role: string) {
  return ['ADMIN', 'FINANCE'].includes(role)
}
