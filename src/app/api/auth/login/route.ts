import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email en wachtwoord zijn verplicht' }, { status: 400 })
    }

    const db = getDb()
    const user = db.prepare(
      'SELECT * FROM users WHERE email = ? AND isActive = 1'
    ).get(email.toLowerCase().trim()) as { id: string; email: string; name: string; passwordHash: string; role: string } | undefined

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
