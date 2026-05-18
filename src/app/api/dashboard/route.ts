import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

// Unified expense CTE: non-split transactions + split lines
const EXPENSE_CTE = `
  WITH expenses AS (
    SELECT transactionDate, listName, groupName, ABS(amount) as amount
    FROM transactions
    WHERE isDeleted = 0 AND direction = 'expense' AND isSplit = 0
    UNION ALL
    SELECT t.transactionDate, s.listName, s.groupName, s.amount
    FROM transaction_splits s
    JOIN transactions t ON t.id = s.transactionId
    WHERE t.isDeleted = 0 AND t.direction = 'expense'
  )
`

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = getDb()

    // Monthly stats: last 12 months (splits count as one transaction for cashflow/count)
    const monthlyStats = db.prepare(`
      SELECT
        strftime('%Y-%m', transactionDate) as month,
        SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN direction = 'expense' THEN ABS(amount) ELSE 0 END) as expenses,
        SUM(CASE WHEN direction = 'income' THEN amount WHEN direction = 'expense' THEN amount ELSE 0 END) as cashflow,
        COUNT(*) as transactionCount
      FROM transactions
      WHERE isDeleted = 0 AND direction != 'transfer'
        AND transactionDate >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month DESC
    `).all()

    // Expense breakdown by list (current month) — includes splits
    const expensesByList = db.prepare(`
      ${EXPENSE_CTE}
      SELECT
        COALESCE(listName, 'Ongecategoriseerd') as listName,
        SUM(amount) as total,
        COUNT(*) as count
      FROM expenses
      WHERE strftime('%Y-%m', transactionDate) = strftime('%Y-%m', 'now')
      GROUP BY listName
      ORDER BY total DESC
    `).all()

    // Expense breakdown by list + group (current month) — includes splits
    const expensesByGroup = db.prepare(`
      ${EXPENSE_CTE}
      SELECT
        COALESCE(listName, 'Ongecategoriseerd') as listName,
        COALESCE(groupName, '') as groupName,
        SUM(amount) as total,
        COUNT(*) as count
      FROM expenses
      WHERE strftime('%Y-%m', transactionDate) = strftime('%Y-%m', 'now')
      GROUP BY listName, groupName
      ORDER BY listName, total DESC
    `).all()

    // Income breakdown current month
    const incomeByList = db.prepare(`
      SELECT
        COALESCE(listName, 'Ongecategoriseerd') as listName,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE isDeleted = 0 AND direction = 'income'
        AND strftime('%Y-%m', transactionDate) = strftime('%Y-%m', 'now')
      GROUP BY listName
      ORDER BY total DESC
    `).all()

    // Uncategorized count (exclude split transactions — they're handled separately)
    const uncategorized = (db.prepare(
      "SELECT COUNT(*) as count FROM transactions WHERE isDeleted = 0 AND listName IS NULL AND isSplit = 0 AND direction != 'transfer'"
    ).get() as { count: number }).count

    // Recurring transactions
    const recurring = db.prepare(`
      SELECT * FROM transactions
      WHERE isDeleted = 0 AND isRecurring = 1
      ORDER BY transactionDate DESC
      LIMIT 50
    `).all()

    // Top merchants (current month)
    const topMerchants = db.prepare(`
      SELECT
        COALESCE(merchant, counterparty, description) as name,
        SUM(ABS(amount)) as total,
        COUNT(*) as count
      FROM transactions
      WHERE isDeleted = 0 AND direction = 'expense'
        AND strftime('%Y-%m', transactionDate) = strftime('%Y-%m', 'now')
      GROUP BY name
      ORDER BY total DESC
      LIMIT 10
    `).all()

    return NextResponse.json({
      monthlyStats,
      expensesByList,
      expensesByGroup,
      incomeByList,
      uncategorized,
      recurring,
      topMerchants,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
