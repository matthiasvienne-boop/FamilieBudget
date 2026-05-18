import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

const EXPENSE_CTE = `
  WITH expenses AS (
    SELECT "transactionDate", "listName", "groupName", ABS(amount) as amount
    FROM transactions
    WHERE "isDeleted" = false AND direction = 'expense' AND "isSplit" = false
    UNION ALL
    SELECT t."transactionDate", s."listName", s."groupName", s.amount
    FROM transaction_splits s
    JOIN transactions t ON t.id = s."transactionId"
    WHERE t."isDeleted" = false AND t.direction = 'expense'
  )
`

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()

    const [monthlyStats, expensesByList, expensesByGroup, incomeByList, uncategorizedRes, recurring, topMerchants] =
      await Promise.all([
        db.query(`
          SELECT
            LEFT("transactionDate", 7) as month,
            SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN direction = 'expense' THEN ABS(amount) ELSE 0 END) as expenses,
            SUM(CASE WHEN direction = 'income' THEN amount WHEN direction = 'expense' THEN amount ELSE 0 END) as cashflow,
            COUNT(*) as "transactionCount"
          FROM transactions
          WHERE "isDeleted" = false AND direction != 'transfer'
            AND "transactionDate" >= (CURRENT_DATE - INTERVAL '12 months')::text
          GROUP BY LEFT("transactionDate", 7)
          ORDER BY LEFT("transactionDate", 7) DESC
        `),
        db.query(`
          ${EXPENSE_CTE}
          SELECT
            COALESCE("listName", 'Ongecategoriseerd') as "listName",
            SUM(amount) as total,
            COUNT(*) as count
          FROM expenses
          WHERE LEFT("transactionDate", 7) = LEFT(CURRENT_DATE::text, 7)
          GROUP BY "listName"
          ORDER BY total DESC
        `),
        db.query(`
          ${EXPENSE_CTE}
          SELECT
            COALESCE("listName", 'Ongecategoriseerd') as "listName",
            COALESCE("groupName", '') as "groupName",
            SUM(amount) as total,
            COUNT(*) as count
          FROM expenses
          WHERE LEFT("transactionDate", 7) = LEFT(CURRENT_DATE::text, 7)
          GROUP BY "listName", "groupName"
          ORDER BY "listName", total DESC
        `),
        db.query(`
          SELECT
            COALESCE("listName", 'Ongecategoriseerd') as "listName",
            SUM(amount) as total,
            COUNT(*) as count
          FROM transactions
          WHERE "isDeleted" = false AND direction = 'income'
            AND LEFT("transactionDate", 7) = LEFT(CURRENT_DATE::text, 7)
          GROUP BY "listName"
          ORDER BY total DESC
        `),
        db.query(`
          SELECT COUNT(*) as count FROM transactions
          WHERE "isDeleted" = false AND "listName" IS NULL AND "isSplit" = false AND direction != 'transfer'
        `),
        db.query(`
          SELECT * FROM transactions
          WHERE "isDeleted" = false AND "isRecurring" = true
          ORDER BY "transactionDate" DESC
          LIMIT 50
        `),
        db.query(`
          SELECT
            COALESCE(merchant, counterparty, description) as name,
            SUM(ABS(amount)) as total,
            COUNT(*) as count
          FROM transactions
          WHERE "isDeleted" = false AND direction = 'expense'
            AND LEFT("transactionDate", 7) = LEFT(CURRENT_DATE::text, 7)
          GROUP BY COALESCE(merchant, counterparty, description)
          ORDER BY total DESC
          LIMIT 10
        `),
      ])

    return NextResponse.json({
      monthlyStats: monthlyStats.rows,
      expensesByList: expensesByList.rows,
      expensesByGroup: expensesByGroup.rows,
      incomeByList: incomeByList.rows,
      uncategorized: parseInt(uncategorizedRes.rows[0].count),
      recurring: recurring.rows,
      topMerchants: topMerchants.rows,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
