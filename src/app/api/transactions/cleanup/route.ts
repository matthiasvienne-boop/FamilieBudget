import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

// POST: hard delete all soft-deleted transactions older than 30 days
export async function POST() {
  const { error } = await requireAuth()
  if (error) return error

  const db = await getDb()

  const result = await db.query(
    `DELETE FROM transactions
     WHERE "isDeleted" = true
       AND "updatedAt" < TO_CHAR(NOW() - INTERVAL '30 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
     RETURNING id`
  )

  return NextResponse.json({ success: true, deleted: result.rowCount })
}
