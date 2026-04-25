import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)

    const month = searchParams.get('month') // "2026-01"
    const source = searchParams.get('source')
    const listName = searchParams.get('listName')
    const groupName = searchParams.get('groupName')
    const direction = searchParams.get('direction')
    const isRecurring = searchParams.get('isRecurring')
    const uncategorized = searchParams.get('uncategorized')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    let where = 'WHERE isDeleted = 0'
    const params: (string | number)[] = []

    if (month) {
      where += ' AND strftime(\'%Y-%m\', transactionDate) = ?'
      params.push(month)
    }
    if (source) {
      where += ' AND source = ?'
      params.push(source)
    }
    if (listName === '__none__') {
      where += ' AND listName IS NULL'
    } else if (listName) {
      where += ' AND listName = ?'
      params.push(listName)
    }
    if (groupName) {
      where += ' AND groupName = ?'
      params.push(groupName)
    }
    if (direction) {
      where += ' AND direction = ?'
      params.push(direction)
    }
    if (isRecurring === 'true') {
      where += ' AND isRecurring = 1'
    } else if (isRecurring === 'false') {
      where += ' AND isRecurring = 0'
    }
    if (uncategorized === 'true') {
      where += ' AND listName IS NULL'
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

    return NextResponse.json({
      data: transactions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const now = new Date().toISOString()
    if ('isRecurring' in updates) updates.isRecurring = updates.isRecurring ? 1 : 0

    const fields = Object.keys(updates)
      .map(k => `${k} = ?`)
      .join(', ')
    const values = Object.values(updates)

    db.prepare(`UPDATE transactions SET ${fields}, updatedAt = ? WHERE id = ?`).run(...values, now, id)

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
    return NextResponse.json(tx)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const now = new Date().toISOString()
    db.prepare('UPDATE transactions SET isDeleted = 1, updatedAt = ? WHERE id = ?').run(now, id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
