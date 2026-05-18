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
  const db = await getDb()

  await db.query(
    'INSERT INTO feedback_replies (id, feedback_id, author, message, created_at) VALUES ($1,$2,$3,$4,$5)',
    [uuidv4(), id, author, body.message, now]
  )

  if (author === 'admin') {
    await db.query('UPDATE feedback SET unread_by_user = true, updated_at = $1 WHERE id = $2', [now, id])
  } else {
    await db.query('UPDATE feedback SET unread_by_admin = true, updated_at = $1 WHERE id = $2', [now, id])
  }

  return NextResponse.json({ ok: true })
}
