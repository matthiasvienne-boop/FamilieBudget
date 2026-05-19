import { NextRequest, NextResponse } from 'next/server'
import { getDb, transaction } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const uid = session.id
    const [listsRes, groupsRes] = await Promise.all([
      db.query(
        `SELECT * FROM transaction_lists WHERE "userId" IS NULL OR "userId" = $1 ORDER BY "sortOrder", name`,
        [uid]
      ),
      db.query(
        `SELECT tg.* FROM transaction_groups tg
         JOIN transaction_lists tl ON tl.id = tg."listId"
         WHERE (tl."userId" IS NULL OR tl."userId" = $1)
           AND (tg."userId" IS NULL OR tg."userId" = $1)
         ORDER BY tg."listName", tg."sortOrder", tg.name`,
        [uid]
      ),
    ])
    return NextResponse.json({ lists: listsRes.rows, groups: groupsRes.rows })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { name, color, accountId } = await request.json()
    const uid = session.id

    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    // Privacy: no accountId context (from Settings) → private by default
    // personal account → private, shared/child account → global
    let listUserId: string | null = uid
    if (accountId) {
      const accRes = await db.query('SELECT type FROM accounts WHERE id = $1', [accountId])
      const acc = accRes.rows[0] as { type: string } | undefined
      if (!acc || acc.type !== 'personal') listUserId = null
    }

    const now = new Date().toISOString()
    const id = uuidv4()
    const maxRes = await db.query('SELECT MAX("sortOrder") as m FROM transaction_lists')
    const maxOrder = (maxRes.rows[0].m as number | null) ?? -1

    await db.query(
      `INSERT INTO transaction_lists (id, name, "userId", color, "sortOrder", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, name.trim(), listUserId, color || null, maxOrder + 1, now, now]
    )

    const result = await db.query('SELECT * FROM transaction_lists WHERE id = $1', [id])
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { id, name, color, makeGlobal } = await request.json() as {
      id: string; name?: string; color?: string; makeGlobal?: boolean
    }
    const uid = session.id

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const listRes = await db.query('SELECT * FROM transaction_lists WHERE id = $1', [id])
    const list = listRes.rows[0] as { name: string; userId: string | null } | undefined
    if (!list) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Global lists (userId=null) can be claimed as private; owned lists require matching uid
    if (list.userId !== null && list.userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const params: unknown[] = []
    const add = (v: unknown) => { params.push(v); return `$${params.length}` }
    const sets: string[] = []

    if (name !== undefined) sets.push(`name = ${add(name.trim())}`)
    if (color !== undefined) sets.push(`color = ${add(color)}`)
    if (makeGlobal === true) sets.push(`"userId" = ${add(null)}`)
    if (makeGlobal === false) sets.push(`"userId" = ${add(uid)}`)
    if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    sets.push(`"updatedAt" = ${add(now)}`)

    if (name !== undefined) {
      await transaction(async (client) => {
        await client.query(`UPDATE transaction_lists SET ${sets.join(', ')} WHERE id = ${add(id)}`, params)
        await client.query('UPDATE transaction_groups SET "listName" = $1 WHERE "listId" = $2', [name.trim(), id])
        await client.query('UPDATE transactions SET "listName" = $1 WHERE "listName" = $2', [name.trim(), list.name])
      })
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
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const uid = session.id

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const listRes = await db.query('SELECT * FROM transaction_lists WHERE id = $1', [id])
    const list = listRes.rows[0] as { name: string; userId: string | null } | undefined
    if (!list) return NextResponse.json({ success: true })
    if (list.userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.query('UPDATE transactions SET "listName" = NULL, "groupName" = NULL WHERE "listName" = $1', [list.name])
    await db.query('DELETE FROM transaction_lists WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 })
  }
}
