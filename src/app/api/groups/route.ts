import { NextRequest, NextResponse } from 'next/server'
import { getDb, transaction } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { listId, listName, name } = await request.json()

    if (!listId || !name?.trim()) {
      return NextResponse.json({ error: 'listId and name required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = uuidv4()
    const maxRes = await db.query(`SELECT MAX("sortOrder") as m FROM transaction_groups WHERE "listId" = $1`, [listId])
    const maxOrder = (maxRes.rows[0].m as number | null) ?? -1

    await db.query(
      `INSERT INTO transaction_groups (id, "listId", "listName", name, "sortOrder", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, listId, listName, name.trim(), maxOrder + 1, now, now]
    )

    const result = await db.query('SELECT * FROM transaction_groups WHERE id = $1', [id])
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { id, name } = await request.json()

    if (!id || !name?.trim()) {
      return NextResponse.json({ error: 'id and name required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const oldRes = await db.query('SELECT * FROM transaction_groups WHERE id = $1', [id])
    const old = oldRes.rows[0] as { name: string; listName: string } | undefined

    await transaction(async (client) => {
      await client.query('UPDATE transaction_groups SET name = $1, "updatedAt" = $2 WHERE id = $3', [name.trim(), now, id])
      if (old) {
        await client.query(
          'UPDATE transactions SET "groupName" = $1 WHERE "listName" = $2 AND "groupName" = $3',
          [name.trim(), old.listName, old.name]
        )
      }
    })

    const result = await db.query('SELECT * FROM transaction_groups WHERE id = $1', [id])
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
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

    const groupRes = await db.query('SELECT * FROM transaction_groups WHERE id = $1', [id])
    const group = groupRes.rows[0] as { name: string; listName: string } | undefined

    if (group) {
      await db.query(
        'UPDATE transactions SET "groupName" = NULL WHERE "listName" = $1 AND "groupName" = $2',
        [group.listName, group.name]
      )
    }
    await db.query('DELETE FROM transaction_groups WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
