import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

type Scope = 'all' | 'personal' | 'shared'

function buildAccess(uid: string, params: unknown[], scope: Scope) {
  const $uid = () => { params.push(uid); return `$${params.length}` }
  const uidRef = $uid()

  const typeFilter = scope === 'all'
    ? ''
    : ` AND a.type = '${scope === 'personal' ? 'personal' : 'shared'}'`

  const sub = `SELECT am."accountId" FROM account_members am JOIN accounts a ON a.id = am."accountId" WHERE am."userId" = ${uidRef}${typeFilter}`

  const noAccount = scope === 'all' ? `"accountId" IS NULL OR ` : ''
  const noAccountT = scope === 'all' ? `t."accountId" IS NULL OR ` : ''

  return {
    ACCESS: `(${noAccount}"accountId" IN (${sub}))`,
    ACCESS_T: `(${noAccountT}t."accountId" IN (${sub}))`,
  }
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const uid = session.id
    const params = new URL(request.url).searchParams
    const scope = (params.get('scope') || 'all') as Scope
    const now = new Date()
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const month = params.get('month') || currentYM

    const mkAccess = (extraParams: unknown[] = []) => {
      const p: unknown[] = [...extraParams]
      return { ...buildAccess(uid, p, scope), p }
    }

    // month param is pushed first for q2-q4, q7 so it becomes $1
    const q1 = mkAccess()
    const q2 = mkAccess([month])
    const q3 = mkAccess([month])
    const q4 = mkAccess([month])
    const q5 = mkAccess()
    const q6 = mkAccess()
    const q7 = mkAccess([month])

    // For q1: show 13 months up to and including the selected month
    q1.p.push(month)
    const monthRef1 = `$${q1.p.length}`

    const expenseCTE = (ACCESS: string, ACCESS_T: string) => `
      WITH expenses AS (
        SELECT "transactionDate", "listName", "groupName", ABS(amount) as amount
        FROM transactions
        WHERE "isDeleted" = false AND direction = 'expense' AND "isSplit" = false AND ${ACCESS}
        UNION ALL
        SELECT t."transactionDate", s."listName", s."groupName", s.amount
        FROM transaction_splits s
        JOIN transactions t ON t.id = s."transactionId"
        WHERE t."isDeleted" = false AND t.direction = 'expense' AND ${ACCESS_T}
      )
    `

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
            AND LEFT("transactionDate", 7) <= ${monthRef1}
            AND LEFT("transactionDate", 7) > TO_CHAR((TO_DATE(${monthRef1}, 'YYYY-MM') - INTERVAL '12 months'), 'YYYY-MM')
            AND ${q1.ACCESS}
          GROUP BY LEFT("transactionDate", 7)
          ORDER BY LEFT("transactionDate", 7) DESC
        `, q1.p),
        db.query(`
          ${expenseCTE(q2.ACCESS, q2.ACCESS_T)}
          SELECT
            COALESCE("listName", 'Ongecategoriseerd') as "listName",
            SUM(amount) as total,
            COUNT(*) as count
          FROM expenses
          WHERE LEFT("transactionDate", 7) = $1
          GROUP BY "listName"
          ORDER BY total DESC
        `, q2.p),
        db.query(`
          ${expenseCTE(q3.ACCESS, q3.ACCESS_T)}
          SELECT
            COALESCE("listName", 'Ongecategoriseerd') as "listName",
            COALESCE("groupName", '') as "groupName",
            SUM(amount) as total,
            COUNT(*) as count
          FROM expenses
          WHERE LEFT("transactionDate", 7) = $1
          GROUP BY "listName", "groupName"
          ORDER BY "listName", total DESC
        `, q3.p),
        db.query(`
          SELECT
            COALESCE("listName", 'Ongecategoriseerd') as "listName",
            SUM(amount) as total,
            COUNT(*) as count
          FROM transactions
          WHERE "isDeleted" = false AND direction = 'income'
            AND LEFT("transactionDate", 7) = $1
            AND ${q4.ACCESS}
          GROUP BY "listName"
          ORDER BY total DESC
        `, q4.p),
        db.query(`
          SELECT COUNT(*) as count FROM transactions
          WHERE "isDeleted" = false AND "listName" IS NULL AND "isSplit" = false AND direction != 'transfer'
            AND ${q5.ACCESS}
        `, q5.p),
        db.query(`
          SELECT * FROM transactions
          WHERE "isDeleted" = false AND "isRecurring" = true AND ${q6.ACCESS}
          ORDER BY "transactionDate" DESC
          LIMIT 50
        `, q6.p),
        db.query(`
          SELECT
            COALESCE(merchant, counterparty, description) as name,
            SUM(ABS(amount)) as total,
            COUNT(*) as count
          FROM transactions
          WHERE "isDeleted" = false AND direction = 'expense'
            AND LEFT("transactionDate", 7) = $1
            AND ${q7.ACCESS}
          GROUP BY COALESCE(merchant, counterparty, description)
          ORDER BY total DESC
          LIMIT 10
        `, q7.p),
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
