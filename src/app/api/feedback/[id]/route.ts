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

  const pgParams: unknown[] = []
  const add = (v: unknown) => { pgParams.push(v); return `$${pgParams.length}` }
  const sets: string[] = []

  if (body.status !== undefined)          sets.push(`status = ${add(body.status)}`)
  if (body.unread_by_admin !== undefined) sets.push(`unread_by_admin = ${add(!!body.unread_by_admin)}`)
  if (body.unread_by_user !== undefined)  sets.push(`unread_by_user = ${add(!!body.unread_by_user)}`)
  if (body.admin_reply !== undefined)     sets.push(`admin_reply = ${add(body.admin_reply)}`)

  if (sets.length === 0) return NextResponse.json({ ok: true })

  sets.push(`updated_at = ${add(now)}`)

  await db.query(`UPDATE feedback SET ${sets.join(', ')} WHERE id = ${add(id)}`, pgParams)
  return NextResponse.json({ ok: true })
}
