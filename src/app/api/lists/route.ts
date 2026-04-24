import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const db = getDb()
    const lists = db.prepare('SELECT * FROM transaction_lists ORDER BY sortOrder, name').all()
    const groups = db.prepare('SELECT * FROM transaction_groups ORDER BY listName, sortOrder, name').all()
    return NextResponse.json({ lists, groups })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { name, color } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const now = new Date().toISOString()
    const id = uuidv4()
    const maxOrder = (db.prepare('SELECT MAX(sortOrder) as m FROM transaction_lists').get() as { m: number | null }).m ?? -1

    db.prepare(
      'INSERT INTO transaction_lists (id, name, color, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name.trim(), color || null, maxOrder + 1, now, now)

    const list = db.prepare('SELECT * FROM transaction_lists WHERE id = ?').get(id)
    return NextResponse.json(list)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { id, name, color } = body

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const now = new Date().toISOString()
    const updates: string[] = []
    const values: unknown[] = []

    if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()) }
    if (color !== undefined) { updates.push('color = ?'); values.push(color) }

    if (updates.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    db.prepare(`UPDATE transaction_lists SET ${updates.join(', ')}, updatedAt = ? WHERE id = ?`).run(...values, now, id)

    // If name changed, update groups and transactions
    if (name !== undefined) {
      const old = db.prepare('SELECT name FROM transaction_lists WHERE id = ?').get(id) as { name: string } | undefined
      if (old) {
        db.prepare('UPDATE transaction_groups SET listName = ? WHERE listId = ?').run(name.trim(), id)
        db.prepare('UPDATE transactions SET listName = ? WHERE listName = ?').run(name.trim(), old.name)
      }
    }

    const list = db.prepare('SELECT * FROM transaction_lists WHERE id = ?').get(id)
    return NextResponse.json(list)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const list = db.prepare('SELECT name FROM transaction_lists WHERE id = ?').get(id) as { name: string } | undefined
    if (list) {
      db.prepare('UPDATE transactions SET listName = NULL, groupName = NULL WHERE listName = ?').run(list.name)
    }

    db.prepare('DELETE FROM transaction_lists WHERE id = ?').run(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 })
  }
}
