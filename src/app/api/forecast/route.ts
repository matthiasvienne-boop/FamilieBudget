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

function classifyFrequency(medianGapDays: number) {
  if (medianGapDays <= 10)  return { frequency: 'weekly',      label: 'Wekelijks',        monthlyFactor: 4.33 }
  if (medianGapDays <= 45)  return { frequency: 'monthly',     label: 'Maandelijks',      monthlyFactor: 1 }
  if (medianGapDays <= 70)  return { frequency: 'bimonthly',   label: 'Tweemaandelijks',  monthlyFactor: 0.5 }
  if (medianGapDays <= 110) return { frequency: 'quarterly',   label: 'Driemaandelijks',  monthlyFactor: 1 / 3 }
  if (medianGapDays <= 200) return { frequency: 'semiannual',  label: 'Halfjaarlijks',    monthlyFactor: 1 / 6 }
  return                           { frequency: 'annual',      label: 'Jaarlijks',        monthlyFactor: 1 / 12 }
}

function isExpectedNextMonth(lastDateStr: string, medianGapDays: number, nextMonthStart: Date): boolean {
  const lastDate = new Date(lastDateStr)
  const periodMs = medianGapDays * 24 * 60 * 60 * 1000
  const expectedDate = new Date(lastDate.getTime() + periodMs)
  const nextMonthEnd = new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth() + 1, 0)
  // Allow ±7 days tolerance around expected date
  const windowStart = new Date(nextMonthStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const windowEnd = new Date(nextMonthEnd.getTime() + 7 * 24 * 60 * 60 * 1000)
  return expectedDate >= windowStart && expectedDate <= windowEnd
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const uid = session.id
    const urlParams = new URL(request.url).searchParams
    const scope = (urlParams.get('scope') || 'all') as Scope

    const mkAccess = () => { const p: unknown[] = []; return { ...buildAccess(uid, p, scope), p } }

    const now = new Date()
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const nextMonth = `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, '0')}`

    // Last 3 complete months for averages
    const avgMonths: string[] = []
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      avgMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const q1 = mkAccess()
    const q2 = mkAccess()
    const q3 = mkAccess()

    q2.p.push(...avgMonths)
    const ph2 = avgMonths.map((_, i) => `$${q2.p.length - avgMonths.length + 1 + i}`).join(',')

    q3.p.push(...avgMonths)
    const ph3 = avgMonths.map((_, i) => `$${q3.p.length - avgMonths.length + 1 + i}`).join(',')

    const [recurringRes, avgExpensesRes, avgIncomeRes] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(merchant, counterparty, description) as series_key,
          MAX("recurringLabel") as label,
          "listName", "groupName", direction, currency,
          AVG(ABS(amount)) as avg_amount,
          MAX("transactionDate") as last_date,
          COUNT(*) as occurrences,
          ARRAY_AGG("transactionDate" ORDER BY "transactionDate") as dates
        FROM transactions
        WHERE "isDeleted" = false AND "isRecurring" = true
          AND (
            "recurringEndDate" IS NULL
            OR "recurringEndDate" >= '${nextMonthStart.toISOString().slice(0, 10)}'
          )
          AND ${q1.ACCESS}
        GROUP BY COALESCE(merchant, counterparty, description), "listName", "groupName", direction, currency
        ORDER BY direction, "listName", avg_amount DESC
      `, q1.p),

      db.query(`
        SELECT
          COALESCE("listName", 'Ongecategoriseerd') as "listName",
          SUM(ABS(amount)) / ${avgMonths.length} as avg_monthly
        FROM transactions
        WHERE "isDeleted" = false AND direction = 'expense' AND "isSplit" = false
          AND LEFT("transactionDate", 7) IN (${ph2})
          AND ${q2.ACCESS}
        GROUP BY COALESCE("listName", 'Ongecategoriseerd')
        ORDER BY avg_monthly DESC
      `, q2.p),

      db.query(`
        SELECT
          COALESCE("listName", 'Ongecategoriseerd') as "listName",
          SUM(amount) / ${avgMonths.length} as avg_monthly
        FROM transactions
        WHERE "isDeleted" = false AND direction = 'income' AND "isSplit" = false
          AND LEFT("transactionDate", 7) IN (${ph3})
          AND ${q3.ACCESS}
        GROUP BY COALESCE("listName", 'Ongecategoriseerd')
        ORDER BY avg_monthly DESC
      `, q3.p),
    ])

    type RawRow = {
      series_key: string
      label: string | null
      listName: string | null
      groupName: string | null
      direction: string
      currency: string
      avg_amount: string
      last_date: string
      occurrences: string
      dates: string[]
    }

    const recurring = recurringRes.rows.map((row: RawRow) => {
      const dates = row.dates
      let medianGapDays = 30

      if (dates.length >= 2) {
        const gaps: number[] = []
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1])
          const curr = new Date(dates[i])
          gaps.push((curr.getTime() - prev.getTime()) / 86400000)
        }
        gaps.sort((a, b) => a - b)
        medianGapDays = gaps[Math.floor(gaps.length / 2)]
      }

      const { frequency, label: freqLabel, monthlyFactor } = classifyFrequency(medianGapDays)
      const amount = parseFloat(row.avg_amount)

      return {
        seriesKey: row.series_key,
        name: row.label || row.series_key,
        listName: row.listName,
        groupName: row.groupName,
        direction: row.direction as 'income' | 'expense',
        amount,
        frequency,
        frequencyLabel: freqLabel,
        monthlyEquivalent: amount * monthlyFactor,
        expectedNextMonth: isExpectedNextMonth(row.last_date, medianGapDays, nextMonthStart),
        lastDate: row.last_date,
        occurrences: parseInt(row.occurrences),
      }
    })

    type AvgRow = { listName: string; avg_monthly: string }

    const avgExpenses = avgExpensesRes.rows.map((r: AvgRow) => ({
      listName: r.listName,
      avgMonthly: parseFloat(r.avg_monthly),
    }))
    const avgIncome = avgIncomeRes.rows.map((r: AvgRow) => ({
      listName: r.listName,
      avgMonthly: parseFloat(r.avg_monthly),
    }))

    const expectedRecurringExpenses = recurring
      .filter(r => r.direction === 'expense' && r.expectedNextMonth)
      .reduce((s, r) => s + r.amount, 0)
    const expectedRecurringIncome = recurring
      .filter(r => r.direction === 'income' && r.expectedNextMonth)
      .reduce((s, r) => s + r.amount, 0)

    const forecastExpenses = avgExpenses.reduce((s, r) => s + r.avgMonthly, 0)
    const forecastIncome = avgIncome.reduce((s, r) => s + r.avgMonthly, 0)

    return NextResponse.json({
      nextMonth,
      avgMonths,
      recurring,
      expectedRecurringExpenses,
      expectedRecurringIncome,
      avgExpensesByCategory: avgExpenses,
      avgIncomeByCategory: avgIncome,
      forecastExpenses,
      forecastIncome,
      forecastCashflow: forecastIncome - forecastExpenses,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const uid = session.id
    const { seriesKey, label } = await request.json() as { seriesKey: string; label: string | null }

    if (!seriesKey) return NextResponse.json({ error: 'seriesKey required' }, { status: 400 })

    // Build access filter so users can only label their own transactions
    const p: unknown[] = []
    const { ACCESS } = buildAccess(uid, p, 'all')
    p.push(label || null)
    const labelRef = `$${p.length}`
    p.push(seriesKey)
    const keyRef = `$${p.length}`

    await db.query(`
      UPDATE transactions
      SET "recurringLabel" = ${labelRef}
      WHERE "isRecurring" = true
        AND "isDeleted" = false
        AND COALESCE(merchant, counterparty, description) = ${keyRef}
        AND ${ACCESS}
    `, p)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
