import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest) {
  const isAdmin = req.nextUrl.searchParams.get('all') === 'true'
  const auth = isAdmin ? await requireAdmin() : await requireAuth()
  if (auth.error) return auth.error

  const db = await getDb()
  const rows = isAdmin
    ? (await db.query('SELECT * FROM feedback ORDER BY created_at DESC')).rows
    : (await db.query('SELECT * FROM feedback WHERE created_by = $1 ORDER BY created_at DESC', [auth.session.email])).rows

  const result = await Promise.all(rows.map(async (f: any) => ({
    ...f,
    replies: (await db.query('SELECT * FROM feedback_replies WHERE feedback_id = $1 ORDER BY created_at ASC', [f.id])).rows,
  })))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const db = await getDb()
  const body = await req.json()
  const now = new Date().toISOString()
  const id = uuidv4()

  await db.query(`
    INSERT INTO feedback (id, title, message, type, section, status, created_by, page, unread_by_admin, unread_by_user, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,'Nieuw',$6,$7,true,false,$8,$9)
  `, [id, body.title, body.message, body.type ?? 'Suggestie', body.section ?? 'Andere', auth.session.email, body.page ?? null, now, now])

  return NextResponse.json({ id })
}
