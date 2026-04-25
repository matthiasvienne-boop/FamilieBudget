import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const db = getDb()
  const users = db.prepare(
    'SELECT id, email, name, role, isActive, createdAt FROM users ORDER BY createdAt ASC'
  ).all()

  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const session = await getSession()

  const db = getDb()
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c

  // Allow creating first user without auth, require admin for subsequent
  if (userCount > 0 && (!session || session.role !== 'admin')) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { email, name, password, role } = await request.json()

  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Email, naam en wachtwoord zijn verplicht' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Wachtwoord moet minstens 6 tekens zijn' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const now = new Date().toISOString()
  const id = uuidv4()
  const assignedRole = userCount === 0 ? 'admin' : (role || 'member')

  try {
    db.prepare(
      'INSERT INTO users (id, email, name, passwordHash, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
    ).run(id, email.toLowerCase().trim(), name.trim(), passwordHash, assignedRole, now, now)

    return NextResponse.json({ id, email, name, role: assignedRole })
  } catch {
    return NextResponse.json({ error: 'E-mailadres bestaat al' }, { status: 409 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { id, name, password, role, isActive } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = getDb()
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { updatedAt: now }

  if (name) updates.name = name.trim()
  if (role) updates.role = role
  if (typeof isActive === 'boolean') updates.isActive = isActive ? 1 : 0
  if (password) {
    if (password.length < 6) return NextResponse.json({ error: 'Wachtwoord te kort' }, { status: 400 })
    updates.passwordHash = await bcrypt.hash(password, 12)
  }

  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...Object.values(updates), id)

  return NextResponse.json({ success: true })
}
