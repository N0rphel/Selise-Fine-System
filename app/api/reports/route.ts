import { auth } from '@/auth'
import { isAdmin, canViewFinance } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'


import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!canViewFinance(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'monthly'
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  if (type === 'monthly') {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)

    const violations = await db.violationReport.findMany({
      where: { status: 'APPROVED', deletedAt: null, createdAt: { gte: start, lte: end } },
      include: { developer: true, project: true, items: { include: { rule: true } }, payment: true },
    })

    const grouped = new Map<string, { developer: any; project: any; count: number; total: number; collected: number }>()
    violations.forEach(v => {
      const key = `${v.developerId}:${v.projectId}`
      const paid = v.payment?.status === 'CONFIRMED' ? v.totalFine : 0
      const existing = grouped.get(key)
      if (existing) { existing.count++; existing.total += v.totalFine; existing.collected += paid }
      else grouped.set(key, { developer: v.developer, project: v.project, count: 1, total: v.totalFine, collected: paid })
    })

    return NextResponse.json({
      type: 'monthly',
      period: `${year}-${String(month).padStart(2, '0')}`,
      rows: Array.from(grouped.values()).sort((a, b) => b.total - a.total),
      grandTotal: violations.reduce((s, v) => s + v.totalFine, 0),
      grandCollected: violations.reduce((s, v) => s + (v.payment?.status === 'CONFIRMED' ? v.totalFine : 0), 0),
    })
  }

  if (type === 'rules') {
    const violations = await db.violationItem.findMany({
      where: { report: { status: 'APPROVED', deletedAt: null } },
      include: { rule: true },
    })
    const grouped = new Map<string, { rule: any; count: number; total: number }>()
    violations.forEach(i => {
      const existing = grouped.get(i.ruleId)
      if (existing) { existing.count++; existing.total += i.fineAmount }
      else grouped.set(i.ruleId, { rule: i.rule, count: 1, total: i.fineAmount })
    })
    return NextResponse.json({
      type: 'rules',
      rows: Array.from(grouped.values()).sort((a, b) => b.total - a.total),
    })
  }

  if (type === 'projects') {
    const violations = await db.violationReport.findMany({
      where: { status: 'APPROVED', deletedAt: null },
      include: { project: true },
    })
    const grouped = new Map<string, { project: any; count: number; total: number }>()
    violations.forEach(v => {
      const existing = grouped.get(v.projectId)
      if (existing) { existing.count++; existing.total += v.totalFine }
      else grouped.set(v.projectId, { project: v.project, count: 1, total: v.totalFine })
    })
    return NextResponse.json({
      type: 'projects',
      rows: Array.from(grouped.values()).sort((a, b) => b.total - a.total),
    })
  }

  if (type === 'developer') {
    const violations = await db.violationReport.findMany({
      where: { status: 'APPROVED', deletedAt: null },
      include: { developer: true, payment: true },
    })
    const grouped = new Map<string, { developer: any; count: number; total: number; collected: number }>()
    violations.forEach(v => {
      const paid = v.payment?.status === 'CONFIRMED' ? v.totalFine : 0
      const existing = grouped.get(v.developerId)
      if (existing) { existing.count++; existing.total += v.totalFine; existing.collected += paid }
      else grouped.set(v.developerId, { developer: v.developer, count: 1, total: v.totalFine, collected: paid })
    })
    const rows = Array.from(grouped.values()).sort((a, b) => b.total - a.total)
    return NextResponse.json({
      type: 'developer',
      rows,
      grandTotal: rows.reduce((s, r) => s + r.total, 0),
      grandCollected: rows.reduce((s, r) => s + r.collected, 0),
    })
  }

  return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
}
