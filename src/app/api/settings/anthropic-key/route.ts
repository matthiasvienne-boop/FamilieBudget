import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  const db = await getDb()
  const result = await db.query(`SELECT value FROM app_settings WHERE key = 'anthropic_api_key'`)
  const row = result.rows[0] as { value: string } | undefined

  if (!row) return NextResponse.json({ masked: '' })

  const val = row.value
  const masked = val.length > 8 ? val.slice(0, 7) + '•'.repeat(Math.min(val.length - 7, 20)) : '••••••••'
  return NextResponse.json({ masked })
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { key } = await request.json()
  if (!key || typeof key !== 'string' || !key.startsWith('sk-ant-')) {
    return NextResponse.json({ error: 'Ongeldige Anthropic API-sleutel' }, { status: 400 })
  }

  const db = await getDb()
  const now = new Date().toISOString()
  await db.query(`
    INSERT INTO app_settings (key, value, "updatedAt") VALUES ('anthropic_api_key', $1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = EXCLUDED."updatedAt"
  `, [key.trim(), now])

  return NextResponse.json({ success: true })
}
