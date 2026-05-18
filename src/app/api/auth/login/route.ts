import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import bcrypt from 'bcryptjs'

const attempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Te veel aanmeldpogingen. Probeer later opnieuw.' }, { status: 429 })
    }

    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email en wachtwoord zijn verplicht' }, { status: 400 })
    }

    const db = await getDb()
    const result = await db.query(
      `SELECT * FROM users WHERE email = $1 AND "isActive" = true`,
      [email.toLowerCase().trim()]
    )
    const user = result.rows[0] as { id: string; email: string; name: string; passwordHash: string; role: string } | undefined

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Ongeldig e-mailadres of wachtwoord' }, { status: 401 })
    }

    const token = await signToken({ id: user.id, email: user.email, name: user.name, role: user.role })

    const response = NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Aanmelden mislukt' }, { status: 500 })
  }
}
