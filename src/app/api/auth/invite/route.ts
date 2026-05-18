import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error) return error

  const { email, name, role } = await request.json()

  if (!email || !name) {
    return NextResponse.json({ error: 'Email en naam zijn verplicht' }, { status: 400 })
  }

  const db = await getDb()

  // Check if user already exists
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()])
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'Dit e-mailadres heeft al een account' }, { status: 409 })
  }

  // Invalidate any existing unused invites for this email
  await db.query('DELETE FROM invites WHERE email = $1 AND used_at IS NULL', [email.toLowerCase().trim()])

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  const now = new Date().toISOString()

  await db.query(
    `INSERT INTO invites (id, email, name, role, token, expires_at, created_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [uuidv4(), email.toLowerCase().trim(), name.trim(), role || 'member', token, expiresAt, session.email, now]
  )

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'https://familiebudget-production.up.railway.app'
  const inviteUrl = `${baseUrl}/auth/register/${token}`

  return NextResponse.json({ inviteUrl, expiresAt })
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const db = await getDb()
  const result = await db.query(
    `SELECT id, email, name, role, expires_at, used_at, created_by, created_at FROM invites ORDER BY created_at DESC`
  )
  return NextResponse.json(result.rows)
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = await getDb()
  await db.query('DELETE FROM invites WHERE id = $1', [id])
  return NextResponse.json({ success: true })
}
