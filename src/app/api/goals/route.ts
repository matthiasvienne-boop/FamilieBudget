import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

const ACCESS = `("accountId" IS NULL OR "accountId" IN (SELECT "accountId" FROM account_members WHERE "userId" = $1))`
const ACCESS_T = `(t."accountId" IS NULL OR t."accountId" IN (SELECT "accountId" FROM account_members WHERE "userId" = $1))`

const EXPENSE_CTE = `
  WITH expenses AS (
    SELECT "transactionDate", "listName", "groupName", ABS(amount) as amount
    FROM transactions
    WHERE "isDeleted" = false AND direction = 'expense' AND "isSplit" = false AND "listName" IS NOT NULL AND ${ACCESS}
    UNION ALL
    SELECT t."transactionDate", s."listName", s."groupName", s.amount
    FROM transaction_splits s
    JOIN transactions t ON t.id = s."transactionId"
    WHERE t."isDeleted" = false AND t.direction = 'expense' AND s."listName" IS NOT NULL AND ${ACCESS_T}
  )
`

export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const uid = session.id

    const [goalsRes, historyRes, currentMonthRes, currentYearRes] = await Promise.all([
      db.query(`SELECT id, "listName", "groupName", month, "goalAmount", direction, COALESCE(period, 'month') as period FROM budget_goals ORDER BY "listName", "groupName"`),
      db.query(`
        ${EXPENSE_CTE}
        SELECT
          "listName",
          COALESCE("groupName", '') as "groupName",
          LEFT("transactionDate", 7) as month,
          SUM(amount) as total
        FROM expenses
        WHERE "transactionDate" >= (CURRENT_DATE - INTERVAL '12 months')::text
        GROUP BY "listName", "groupName", LEFT("transactionDate", 7)
        ORDER BY "listName", "groupName", LEFT("transactionDate", 7) DESC
      `, [uid]),
      db.query(`
        ${EXPENSE_CTE}
        SELECT
          "listName",
          COALESCE("groupName", '') as "groupName",
          SUM(amount) as total
        FROM expenses
        WHERE LEFT("transactionDate", 7) = LEFT(CURRENT_DATE::text, 7)
        GROUP BY "listName", "groupName"
      `, [uid]),
      db.query(`
        ${EXPENSE_CTE}
        SELECT
          "listName",
          COALESCE("groupName", '') as "groupName",
          SUM(amount) as total
        FROM expenses
        WHERE LEFT("transactionDate", 4) = LEFT(CURRENT_DATE::text, 4)
        GROUP BY "listName", "groupName"
      `, [uid]),
    ])

    return NextResponse.json({
      goals: goalsRes.rows,
      history: historyRes.rows,
      currentMonth: currentMonthRes.rows,
      currentYear: currentYearRes.rows,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { listName, groupName, month, goalAmount, direction, period } = await request.json()

    if (!listName || goalAmount == null) {
      return NextResponse.json({ error: 'listName en goalAmount zijn verplicht' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = uuidv4()

    await db.query(`
      INSERT INTO budget_goals (id, "listName", "groupName", month, "goalAmount", direction, period, "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT ("listName", "groupName", month)
      DO UPDATE SET "goalAmount" = EXCLUDED."goalAmount", period = EXCLUDED.period, "updatedAt" = EXCLUDED."updatedAt"
    `, [id, listName, groupName || '', month || '', goalAmount, direction || 'expense', period || 'month', now, now])

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
    const db = await getDb()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await db.query('DELETE FROM budget_goals WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
