import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest) {
  const isAdmin = req.nextUrl.searchParams.get('all') === 'true'
  const auth = isAdmin ? await requireAdmin() : await requireAuth()
  if (auth.error) return auth.error

  const db = getDb()
  const rows = isAdmin
    ? db.prepare('SELECT * FROM feedback ORDER BY created_at DESC').all() as any[]
    : db.prepare('SELECT * FROM feedback WHERE created_by = ? ORDER BY created_at DESC').all(auth.session.email) as any[]

  return NextResponse.json(rows.map(f => ({
    ...f,
    unread_by_admin: !!f.unread_by_admin,
    unread_by_user: !!f.unread_by_user,
    replies: db.prepare('SELECT * FROM feedback_replies WHERE feedback_id = ? ORDER BY created_at ASC').all(f.id),
  })))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const db = getDb()
  const body = await req.json()
  const now = new Date().toISOString()
  const id = uuidv4()

  db.prepare(`
    INSERT INTO feedback (id, title, message, type, section, status, created_by, page, unread_by_admin, unread_by_user, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'Nieuw', ?, ?, 1, 0, ?, ?)
  `).run(id, body.title, body.message, body.type ?? 'Suggestie', body.section ?? 'Andere', auth.session.email, body.page ?? null, now, now)

  return NextResponse.json({ id })
}
