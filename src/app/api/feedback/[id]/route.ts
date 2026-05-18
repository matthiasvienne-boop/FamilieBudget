import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { id } = await params
  const body = await req.json()
  const now = new Date().toISOString()
  const db = getDb()

  const setClauses: string[] = []
  const values: unknown[] = []

  if (body.status !== undefined)          { setClauses.push('status = ?');          values.push(body.status) }
  if (body.unread_by_admin !== undefined) { setClauses.push('unread_by_admin = ?'); values.push(body.unread_by_admin ? 1 : 0) }
  if (body.unread_by_user !== undefined)  { setClauses.push('unread_by_user = ?');  values.push(body.unread_by_user ? 1 : 0) }
  if (body.admin_reply !== undefined)     { setClauses.push('admin_reply = ?');     values.push(body.admin_reply) }

  if (setClauses.length === 0) return NextResponse.json({ ok: true })

  setClauses.push('updated_at = ?')
  values.push(now, id)

  db.prepare(`UPDATE feedback SET ${setClauses.join(', ')} WHERE id = ?`).run(...values)
  return NextResponse.json({ ok: true })
}
