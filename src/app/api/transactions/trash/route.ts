import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

// GET: list soft-deleted transactions (max 30 days old)
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  const db = await getDb()
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const pageSize = 50

  const result = await db.query(
    `SELECT t.*, a.name as "accountName", a.color as "accountColor"
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t."accountId"
     WHERE t."isDeleted" = true
       AND t."updatedAt" >= NOW() - INTERVAL '30 days'
       AND (t."accountId" IS NULL OR t."accountId" IN (
         SELECT "accountId" FROM account_members WHERE "userId" = $1
       ))
     ORDER BY t."updatedAt" DESC
     LIMIT $2 OFFSET $3`,
    [session.id, pageSize, (page - 1) * pageSize]
  )

  const countResult = await db.query(
    `SELECT COUNT(*) as total FROM transactions t
     WHERE t."isDeleted" = true
       AND t."updatedAt" >= NOW() - INTERVAL '30 days'
       AND (t."accountId" IS NULL OR t."accountId" IN (
         SELECT "accountId" FROM account_members WHERE "userId" = $1
       ))`,
    [session.id]
  )

  return NextResponse.json({
    data: result.rows,
    total: parseInt(countResult.rows[0].total),
    page,
    pageSize,
    totalPages: Math.ceil(parseInt(countResult.rows[0].total) / pageSize),
  })
}

// POST: restore transactions
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  const db = await getDb()
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'Geen ids opgegeven' }, { status: 400 })

  const inPlaceholders = ids.map((_, i) => `$${i + 2}`).join(',')
  const now = new Date().toISOString()

  await db.query(
    `UPDATE transactions SET "isDeleted" = false, "updatedAt" = $1
     WHERE id IN (${inPlaceholders})
       AND ("accountId" IS NULL OR "accountId" IN (
         SELECT "accountId" FROM account_members WHERE "userId" = $${ids.length + 2}
       ))`,
    [now, ...ids, session.id]
  )

  return NextResponse.json({ success: true, restored: ids.length })
}

// DELETE: hard delete specific transactions
export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  const db = await getDb()
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'Geen ids opgegeven' }, { status: 400 })

  const inPlaceholders = ids.map((_, i) => `$${i + 1}`).join(',')

  await db.query(
    `DELETE FROM transactions
     WHERE id IN (${inPlaceholders})
       AND "isDeleted" = true
       AND ("accountId" IS NULL OR "accountId" IN (
         SELECT "accountId" FROM account_members WHERE "userId" = $${ids.length + 1}
       ))`,
    [...ids, session.id]
  )

  return NextResponse.json({ success: true })
}
