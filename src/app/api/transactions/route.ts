import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

const ALLOWED_UPDATE_FIELDS = new Set([
  'listName', 'groupName', 'isRecurring', 'recurringType',
  'recurringEndType', 'recurringEndDate', 'notes', 'isDeleted',
])

export async function GET(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)

    const month = searchParams.get('month')
    const source = searchParams.get('source')
    const listName = searchParams.get('listName')
    const groupName = searchParams.get('groupName')
    const direction = searchParams.get('direction')
    const isRecurring = searchParams.get('isRecurring')
    const uncategorized = searchParams.get('uncategorized')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('pageSize') || '50') || 50))

    let where = 'WHERE isDeleted = 0'
    const params: (string | number)[] = []

    if (month) {
      where += " AND strftime('%Y-%m', transactionDate) = ?"
      params.push(month)
    }
    if (source && ['revolut', 'crelan', 'generic'].includes(source)) {
      where += ' AND source = ?'
      params.push(source)
    }
    if (listName === '__none__') {
      where += ' AND listName IS NULL AND isSplit = 0'
    } else if (listName) {
      where += ' AND listName = ?'
      params.push(listName)
    }
    if (groupName) {
      where += ' AND groupName = ?'
      params.push(groupName)
    }
    if (direction && ['income', 'expense', 'transfer'].includes(direction)) {
      where += ' AND direction = ?'
      params.push(direction)
    }
    if (isRecurring === 'true') {
      where += ' AND isRecurring = 1'
    } else if (isRecurring === 'false') {
      where += ' AND isRecurring = 0'
    }
    if (uncategorized === 'true') {
      where += ' AND listName IS NULL AND isSplit = 0'
    }
    if (search) {
      where += ' AND (description LIKE ? OR counterparty LIKE ? OR merchant LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s)
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM transactions ${where}`).get(...params) as { total: number }
    const total = countResult.total
    const offset = (page - 1) * pageSize

    const transactions = db.prepare(
      `SELECT * FROM transactions ${where} ORDER BY transactionDate DESC, id DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset)

    return NextResponse.json({ data: transactions, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = getDb()
    const body = await request.json()
    const { id, ...rawUpdates } = body

    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    for (const key of Object.keys(rawUpdates)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        updates[key] = rawUpdates[key]
      }
    }

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Geen geldige velden' }, { status: 400 })

    const now = new Date().toISOString()
    if ('isRecurring' in updates) updates.isRecurring = updates.isRecurring ? 1 : 0

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)

    db.prepare(`UPDATE transactions SET ${fields}, updatedAt = ? WHERE id = ?`).run(...values, now, id)

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
    return NextResponse.json(tx)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const now = new Date().toISOString()
    db.prepare('UPDATE transactions SET isDeleted = 1, updatedAt = ? WHERE id = ?').run(now, id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
