import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = getDb()

    const goals = db.prepare('SELECT id, listName, groupName, month, goalAmount, direction, COALESCE(period, \'month\') as period FROM budget_goals ORDER BY listName, groupName').all()

    const EXPENSE_CTE = `
      WITH expenses AS (
        SELECT transactionDate, listName, groupName, ABS(amount) as amount
        FROM transactions
        WHERE isDeleted = 0 AND direction = 'expense' AND isSplit = 0 AND listName IS NOT NULL
        UNION ALL
        SELECT t.transactionDate, s.listName, s.groupName, s.amount
        FROM transaction_splits s
        JOIN transactions t ON t.id = s.transactionId
        WHERE t.isDeleted = 0 AND t.direction = 'expense' AND s.listName IS NOT NULL
      )
    `

    // Historical monthly actuals per list (last 12 months)
    const history = db.prepare(`
      ${EXPENSE_CTE}
      SELECT
        listName,
        COALESCE(groupName, '') as groupName,
        strftime('%Y-%m', transactionDate) as month,
        SUM(amount) as total
      FROM expenses
      WHERE transactionDate >= date('now', '-12 months')
      GROUP BY listName, groupName, month
      ORDER BY listName, groupName, month DESC
    `).all()

    // Current month actuals
    const currentMonth = db.prepare(`
      ${EXPENSE_CTE}
      SELECT
        listName,
        COALESCE(groupName, '') as groupName,
        SUM(amount) as total
      FROM expenses
      WHERE strftime('%Y-%m', transactionDate) = strftime('%Y-%m', 'now')
      GROUP BY listName, groupName
    `).all()

    // Current year actuals (for yearly goals)
    const currentYear = db.prepare(`
      ${EXPENSE_CTE}
      SELECT
        listName,
        COALESCE(groupName, '') as groupName,
        SUM(amount) as total
      FROM expenses
      WHERE strftime('%Y', transactionDate) = strftime('%Y', 'now')
      GROUP BY listName, groupName
    `).all()

    return NextResponse.json({ goals, history, currentMonth, currentYear })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = getDb()
    const { listName, groupName, month, goalAmount, direction, period } = await request.json()

    if (!listName || goalAmount == null) {
      return NextResponse.json({ error: 'listName en goalAmount zijn verplicht' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = uuidv4()

    db.prepare(`
      INSERT INTO budget_goals (id, listName, groupName, month, goalAmount, direction, period, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(listName, groupName, month)
      DO UPDATE SET goalAmount = excluded.goalAmount, period = excluded.period, updatedAt = excluded.updatedAt
    `).run(id, listName, groupName || '', month || '', goalAmount, direction || 'expense', period || 'month', now, now)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

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
