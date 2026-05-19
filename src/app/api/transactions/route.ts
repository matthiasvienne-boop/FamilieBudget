import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

const ALLOWED_UPDATE_FIELDS = new Set([
  'listName', 'groupName', 'isRecurring', 'recurringType',
  'recurringEndType', 'recurringEndDate', 'notes', 'isDeleted',
])

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { searchParams } = new URL(request.url)

    const month = searchParams.get('month')
    const source = searchParams.get('source')
    const listName = searchParams.get('listName')
    const groupName = searchParams.get('groupName')
    const direction = searchParams.get('direction')
    const isRecurring = searchParams.get('isRecurring')
    const uncategorized = searchParams.get('uncategorized')
    const search = searchParams.get('search')
    const accountId = searchParams.get('accountId')
    const sortByRaw = searchParams.get('sortBy') || 'transactionDate'
    const sortDirRaw = searchParams.get('sortDir') || 'desc'
    const SORT_COLS: Record<string, string> = { transactionDate: '"transactionDate"', amount: 'amount', description: 'description' }
    const orderBy = `${SORT_COLS[sortByRaw] ?? '"transactionDate"'} ${sortDirRaw === 'asc' ? 'ASC' : 'DESC'}, id DESC`
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('pageSize') || '50') || 50))

    const params: unknown[] = []
    const p = () => `$${params.length}`
    const add = (v: unknown) => { params.push(v); return `$${params.length}` }

    let where = `WHERE "isDeleted" = false`

    if (month) where += ` AND LEFT("transactionDate", 7) = ${add(month)}`
    if (source && ['revolut', 'crelan', 'generic'].includes(source)) {
      where += ` AND source = ${add(source)}`
    }
    if (listName === '__none__') {
      where += ` AND "listName" IS NULL AND "isSplit" = false`
    } else if (listName) {
      where += ` AND "listName" = ${add(listName)}`
    }
    if (groupName) where += ` AND "groupName" = ${add(groupName)}`
    if (direction && ['income', 'expense', 'transfer'].includes(direction)) {
      where += ` AND direction = ${add(direction)}`
    }
    if (isRecurring === 'true') where += ` AND "isRecurring" = true`
    else if (isRecurring === 'false') where += ` AND "isRecurring" = false`
    if (uncategorized === 'true') where += ` AND "listName" IS NULL AND "isSplit" = false`
    if (search) {
      const s = `%${search}%`
      where += ` AND (description ILIKE ${add(s)} OR counterparty ILIKE ${add(s)} OR merchant ILIKE ${add(s)})`
    }
    if (accountId === '__none__') {
      where += ` AND "accountId" IS NULL`
    } else if (accountId) {
      where += ` AND "accountId" = ${add(accountId)}`
    }

    // Access control: only show transactions from accounts the user is a member of
    where += ` AND ("accountId" IS NULL OR "accountId" IN (SELECT "accountId" FROM account_members WHERE "userId" = ${add(session.id)}))`

    void p // suppress unused warning

    const countResult = await db.query(`SELECT COUNT(*) as total FROM transactions ${where}`, params)
    const total = parseInt(countResult.rows[0].total)
    const offset = (page - 1) * pageSize

    const txResult = await db.query(
      `SELECT t.*, a.name as "accountName", a.color as "accountColor"
       FROM transactions t
       LEFT JOIN accounts a ON a.id = t."accountId"
       ${where} ORDER BY ${orderBy} LIMIT ${add(pageSize)} OFFSET ${add(offset)}`,
      params
    )

    return NextResponse.json({ data: txResult.rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const body = await request.json()
    const { id, ...rawUpdates } = body

    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    for (const key of Object.keys(rawUpdates)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) updates[key] = rawUpdates[key]
    }

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Geen geldige velden' }, { status: 400 })

    const now = new Date().toISOString()
    if ('isRecurring' in updates) updates.isRecurring = !!updates.isRecurring

    const params: unknown[] = []
    const add = (v: unknown) => { params.push(v); return `$${params.length}` }
    const fields = Object.entries(updates).map(([k, v]) => `"${k}" = ${add(v)}`).join(', ')

    const result = await db.query(
      `UPDATE transactions SET ${fields}, "updatedAt" = ${add(now)}
       WHERE id = ${add(id)}
         AND ("accountId" IS NULL OR "accountId" IN (SELECT "accountId" FROM account_members WHERE "userId" = ${add(session.id)}))`,
      params
    )

    if (result.rowCount === 0) return NextResponse.json({ error: 'Geen toegang of niet gevonden' }, { status: 403 })

    const tx = await db.query('SELECT * FROM transactions WHERE id = $1', [id])
    return NextResponse.json(tx.rows[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const now = new Date().toISOString()
    const result = await db.query(
      `UPDATE transactions SET "isDeleted" = true, "updatedAt" = $1
       WHERE id = $2
         AND ("accountId" IS NULL OR "accountId" IN (SELECT "accountId" FROM account_members WHERE "userId" = $3))`,
      [now, id, session.id]
    )

    if (result.rowCount === 0) return NextResponse.json({ error: 'Geen toegang of niet gevonden' }, { status: 403 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
