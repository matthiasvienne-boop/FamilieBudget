import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { id } = await params
  const body = await req.json()
  const now = new Date().toISOString()
  const db = await getDb()
  const isAdmin = auth.session.role === 'admin'

  // Non-admins can only mark their own feedback as read
  if (!isAdmin) {
    const fb = await db.query('SELECT created_by FROM feedback WHERE id = $1', [id])
    if (!fb.rows[0] || fb.rows[0].created_by !== auth.session.email) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }
    if (body.status !== undefined || body.admin_reply !== undefined) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }
  }

  const pgParams: unknown[] = []
  const add = (v: unknown) => { pgParams.push(v); return `$${pgParams.length}` }
  const sets: string[] = []

  if (isAdmin && body.status !== undefined)    sets.push(`status = ${add(body.status)}`)
  if (body.unread_by_admin !== undefined)       sets.push(`unread_by_admin = ${add(!!body.unread_by_admin)}`)
  if (body.unread_by_user !== undefined)        sets.push(`unread_by_user = ${add(!!body.unread_by_user)}`)
  if (isAdmin && body.admin_reply !== undefined) sets.push(`admin_reply = ${add(body.admin_reply)}`)

  if (sets.length === 0) return NextResponse.json({ ok: true })

  sets.push(`updated_at = ${add(now)}`)

  await db.query(`UPDATE feedback SET ${sets.join(', ')} WHERE id = ${add(id)}`, pgParams)
  return NextResponse.json({ ok: true })
}
