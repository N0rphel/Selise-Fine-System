import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { canViewFinance } from '@/lib/permissions'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!canViewFinance(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const accounts = await db.financeAccount.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (!canViewFinance(user.permissions ?? [])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { accountName, accountNumber, bankName, notes, qrCodeBase64 } = body

  if (!accountName || !accountNumber) {
    return NextResponse.json({ error: 'Account name and number are required' }, { status: 400 })
  }

  const account = await db.financeAccount.create({
    data: { accountName, accountNumber, bankName, notes, qrCodeBase64, createdBy: user.id },
  })

  return NextResponse.json(account, { status: 201 })
}
