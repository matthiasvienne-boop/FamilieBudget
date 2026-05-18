import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = await getDb()

  const result = await db.query(
    `SELECT email, name, role, expires_at, used_at FROM invites WHERE token = $1`,
    [token]
  )
  const invite = result.rows[0]

  if (!invite) return NextResponse.json({ error: 'Ongeldige uitnodigingslink' }, { status: 404 })
  if (invite.used_at) return NextResponse.json({ error: 'Deze uitnodiging is al gebruikt' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Deze uitnodiging is verlopen' }, { status: 410 })

  return NextResponse.json({ email: invite.email, name: invite.name })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = await getDb()

  const inviteResult = await db.query(
    `SELECT * FROM invites WHERE token = $1`,
    [token]
  )
  const invite = inviteResult.rows[0]

  if (!invite) return NextResponse.json({ error: 'Ongeldige uitnodigingslink' }, { status: 404 })
  if (invite.used_at) return NextResponse.json({ error: 'Deze uitnodiging is al gebruikt' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Deze uitnodiging is verlopen' }, { status: 410 })

  const { password } = await request.json()

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Wachtwoord moet minstens 8 tekens zijn' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const now = new Date().toISOString()
  const id = uuidv4()

  try {
    await db.query(
      `INSERT INTO users (id, email, name, "passwordHash", role, "isActive", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,true,$6,$7)`,
      [id, invite.email, invite.name, passwordHash, invite.role, now, now]
    )
  } catch {
    return NextResponse.json({ error: 'Dit e-mailadres heeft al een account' }, { status: 409 })
  }

  await db.query(`UPDATE invites SET used_at = $1 WHERE token = $2`, [now, token])

  const jwtToken = await signToken({ id, email: invite.email, name: invite.name, role: invite.role })
  const response = NextResponse.json({ id, email: invite.email, name: invite.name, role: invite.role })
  response.cookies.set(COOKIE_NAME, jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  return response
}
