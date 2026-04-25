import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'anthropic_api_key'").get() as { value: string } | undefined

  if (!row) return NextResponse.json({ masked: '' })

  const val = row.value
  const masked = val.length > 8 ? val.slice(0, 7) + '•'.repeat(Math.min(val.length - 7, 20)) : '••••••••'
  return NextResponse.json({ masked })
}

export async function POST(request: NextRequest) {
  const { key } = await request.json()
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'Ongeldige sleutel' }, { status: 400 })
  }

  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO app_settings (key, value, updatedAt) VALUES ('anthropic_api_key', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
  `).run(key.trim(), now)

  return NextResponse.json({ success: true })
}
