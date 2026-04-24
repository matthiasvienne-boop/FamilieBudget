import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const db = getDb()
    const rules = db.prepare('SELECT * FROM classification_rules ORDER BY priority DESC, createdAt DESC').all()
    return NextResponse.json(rules)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const {
      matchType, matchValue, listName, groupName,
      isRecurring, recurringType, recurringEndType, recurringEndDate,
      applyToFutureImports, priority,
    } = body

    if (!matchType || !matchValue?.trim()) {
      return NextResponse.json({ error: 'matchType and matchValue required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = uuidv4()

    db.prepare(`
      INSERT INTO classification_rules
        (id, matchType, matchValue, listName, groupName, isRecurring, recurringType,
         recurringEndType, recurringEndDate, applyToFutureImports, priority, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, matchType, matchValue.trim(),
      listName ?? null, groupName ?? null,
      isRecurring ? 1 : 0,
      recurringType ?? 'one_time',
      recurringEndType ?? null,
      recurringEndDate ?? null,
      applyToFutureImports !== false ? 1 : 0,
      priority ?? 0,
      now, now
    )

    const rule = db.prepare('SELECT * FROM classification_rules WHERE id = ?').get(id)
    return NextResponse.json(rule)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    db.prepare('DELETE FROM classification_rules WHERE id = ?').run(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
