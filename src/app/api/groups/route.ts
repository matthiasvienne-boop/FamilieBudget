import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { listId, listName, name } = body

    if (!listId || !name?.trim()) {
      return NextResponse.json({ error: 'listId and name required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = uuidv4()
    const maxOrder = (
      db.prepare('SELECT MAX(sortOrder) as m FROM transaction_groups WHERE listId = ?').get(listId) as { m: number | null }
    ).m ?? -1

    db.prepare(
      'INSERT INTO transaction_groups (id, listId, listName, name, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, listId, listName, name.trim(), maxOrder + 1, now, now)

    const group = db.prepare('SELECT * FROM transaction_groups WHERE id = ?').get(id)
    return NextResponse.json(group)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { id, name } = body

    if (!id || !name?.trim()) {
      return NextResponse.json({ error: 'id and name required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const old = db.prepare('SELECT * FROM transaction_groups WHERE id = ?').get(id) as { name: string; listName: string } | undefined

    db.prepare('UPDATE transaction_groups SET name = ?, updatedAt = ? WHERE id = ?').run(name.trim(), now, id)

    if (old) {
      db.prepare('UPDATE transactions SET groupName = ? WHERE listName = ? AND groupName = ?')
        .run(name.trim(), old.listName, old.name)
    }

    const group = db.prepare('SELECT * FROM transaction_groups WHERE id = ?').get(id)
    return NextResponse.json(group)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const group = db.prepare('SELECT * FROM transaction_groups WHERE id = ?').get(id) as { name: string; listName: string } | undefined
    if (group) {
      db.prepare('UPDATE transactions SET groupName = NULL WHERE listName = ? AND groupName = ?')
        .run(group.listName, group.name)
    }

    db.prepare('DELETE FROM transaction_groups WHERE id = ?').run(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
  }
}
