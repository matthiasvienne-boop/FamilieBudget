import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error
  const db = getDb()
  return NextResponse.json(db.prepare('SELECT * FROM faq_items WHERE is_published = 1 ORDER BY order_index ASC, created_at ASC').all())
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const db = getDb()
  const body = await req.json()
  const now = new Date().toISOString()
  const id = uuidv4()

  db.prepare(`
    INSERT INTO faq_items (id, question, answer, is_published, source_feedback_id, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.question, body.answer, body.is_published ? 1 : 0, body.source_feedback_id ?? null, body.order_index ?? 0, now, now)

  return NextResponse.json({ id })
}
