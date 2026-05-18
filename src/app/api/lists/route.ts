import { NextRequest, NextResponse } from 'next/server'
import { getDb, transaction } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const [listsRes, groupsRes] = await Promise.all([
      db.query(`SELECT * FROM transaction_lists ORDER BY "sortOrder", name`),
      db.query(`SELECT * FROM transaction_groups ORDER BY "listName", "sortOrder", name`),
    ])
    return NextResponse.json({ lists: listsRes.rows, groups: groupsRes.rows })
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
    const { name, color } = await request.json()

    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const now = new Date().toISOString()
    const id = uuidv4()
    const maxRes = await db.query('SELECT MAX("sortOrder") as m FROM transaction_lists')
    const maxOrder = (maxRes.rows[0].m as number | null) ?? -1

    await db.query(
      `INSERT INTO transaction_lists (id, name, color, "sortOrder", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, name.trim(), color || null, maxOrder + 1, now, now]
    )

    const result = await db.query('SELECT * FROM transaction_lists WHERE id = $1', [id])
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { id, name, color } = await request.json()

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const now = new Date().toISOString()
    const params: unknown[] = []
    const add = (v: unknown) => { params.push(v); return `$${params.length}` }
    const sets: string[] = []

    if (name !== undefined) sets.push(`name = ${add(name.trim())}`)
    if (color !== undefined) sets.push(`color = ${add(color)}`)
    if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    sets.push(`"updatedAt" = ${add(now)}`)

    if (name !== undefined) {
      const oldRes = await db.query('SELECT name FROM transaction_lists WHERE id = $1', [id])
      const old = oldRes.rows[0] as { name: string } | undefined
      if (old) {
        await transaction(async (client) => {
          await client.query(`UPDATE transaction_lists SET ${sets.join(', ')} WHERE id = ${add(id)}`, params)
          await client.query('UPDATE transaction_groups SET "listName" = $1 WHERE "listId" = $2', [name.trim(), id])
          await client.query('UPDATE transactions SET "listName" = $1 WHERE "listName" = $2', [name.trim(), old.name])
        })
      }
    } else {
      await db.query(`UPDATE transaction_lists SET ${sets.join(', ')} WHERE id = ${add(id)}`, params)
    }

    const result = await db.query('SELECT * FROM transaction_lists WHERE id = $1', [id])
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 })
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

    const listRes = await db.query('SELECT name FROM transaction_lists WHERE id = $1', [id])
    const list = listRes.rows[0] as { name: string } | undefined

    if (list) {
      await db.query('UPDATE transactions SET "listName" = NULL, "groupName" = NULL WHERE "listName" = $1', [list.name])
    }
    await db.query('DELETE FROM transaction_lists WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 })
  }
}
