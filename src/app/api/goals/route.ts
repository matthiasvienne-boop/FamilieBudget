import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const db = getDb()

    const goals = db.prepare('SELECT id, listName, groupName, month, goalAmount, direction FROM budget_goals ORDER BY listName, groupName').all()

    // Historical monthly actuals per list (last 12 months)
    const history = db.prepare(`
      SELECT
        COALESCE(listName, 'Ongecategoriseerd') as listName,
        COALESCE(groupName, '') as groupName,
        strftime('%Y-%m', transactionDate) as month,
        SUM(ABS(amount)) as total
      FROM transactions
      WHERE isDeleted = 0
        AND direction = 'expense'
        AND listName IS NOT NULL
        AND transactionDate >= date('now', '-12 months')
      GROUP BY listName, groupName, month
      ORDER BY listName, groupName, month DESC
    `).all()

    // Current month actuals
    const currentMonth = db.prepare(`
      SELECT
        COALESCE(listName, 'Ongecategoriseerd') as listName,
        COALESCE(groupName, '') as groupName,
        SUM(ABS(amount)) as total
      FROM transactions
      WHERE isDeleted = 0
        AND direction = 'expense'
        AND strftime('%Y-%m', transactionDate) = strftime('%Y-%m', 'now')
      GROUP BY listName, groupName
    `).all()

    return NextResponse.json({ goals, history, currentMonth })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const { listName, groupName, month, goalAmount, direction } = await request.json()

    if (!listName || goalAmount == null) {
      return NextResponse.json({ error: 'listName en goalAmount zijn verplicht' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = uuidv4()

    db.prepare(`
      INSERT INTO budget_goals (id, listName, groupName, month, goalAmount, direction, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(listName, groupName, month)
      DO UPDATE SET goalAmount = excluded.goalAmount, updatedAt = excluded.updatedAt
    `).run(id, listName, groupName || '', month || '', goalAmount, direction || 'expense', now, now)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    db.prepare('DELETE FROM budget_goals WHERE id = ?').run(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
