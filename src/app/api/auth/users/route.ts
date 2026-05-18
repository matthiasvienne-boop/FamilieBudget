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

  const db = await getDb()
  const result = await db.query(
    `SELECT id, email, name, role, "isActive", "createdAt" FROM users ORDER BY "createdAt" ASC`
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const db = await getDb()

  const countRes = await db.query('SELECT COUNT(*) as count FROM users')
  const userCount = parseInt(countRes.rows[0].count)

  if (userCount > 0 && (!session || session.role !== 'admin')) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { email, name, password, role } = await request.json()

  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Email, naam en wachtwoord zijn verplicht' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Wachtwoord moet minstens 8 tekens zijn' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const now = new Date().toISOString()
  const id = uuidv4()
  const assignedRole = userCount === 0 ? 'admin' : (role || 'member')

  try {
    await db.query(
      `INSERT INTO users (id, email, name, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,true,$6,$7)`,
      [id, email.toLowerCase().trim(), name.trim(), passwordHash, assignedRole, now, now]
    )
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

  const db = await getDb()
  const now = new Date().toISOString()
  const params: unknown[] = []
  const add = (v: unknown) => { params.push(v); return `$${params.length}` }
  const sets: string[] = []

  if (name) sets.push(`name = ${add(name.trim())}`)
  if (role) sets.push(`role = ${add(role)}`)
  if (typeof isActive === 'boolean') sets.push(`"isActive" = ${add(isActive)}`)
  if (password) {
    if (password.length < 8) return NextResponse.json({ error: 'Wachtwoord te kort (min 8 tekens)' }, { status: 400 })
    sets.push(`"passwordHash" = ${add(await bcrypt.hash(password, 12))}`)
  }
  sets.push(`"updatedAt" = ${add(now)}`)

  await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ${add(id)}`, params)
  return NextResponse.json({ success: true })
}
