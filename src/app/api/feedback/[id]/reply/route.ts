import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { id } = await params
  const body = await req.json()
  const now = new Date().toISOString()
  const author = body.author ?? 'user'
  const db = getDb()

  db.prepare('INSERT INTO feedback_replies (id, feedback_id, author, message, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), id, author, body.message, now)

  if (author === 'admin') {
    db.prepare('UPDATE feedback SET unread_by_user = 1, updated_at = ? WHERE id = ?').run(now, id)
  } else {
    db.prepare('UPDATE feedback SET unread_by_admin = 1, updated_at = ? WHERE id = ?').run(now, id)
  }

  return NextResponse.json({ ok: true })
}
