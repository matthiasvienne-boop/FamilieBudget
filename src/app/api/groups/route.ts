import { NextRequest, NextResponse } from 'next/server'
import { getDb, transaction } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

async function resolveGroupUserId(db: Awaited<ReturnType<typeof getDb>>, accountId: string | null | undefined, uid: string): Promise<string | null> {
  if (!accountId) return uid
  const accRes = await db.query('SELECT type FROM accounts WHERE id = $1', [accountId])
  const acc = accRes.rows[0] as { type: string } | undefined
  if (!acc || acc.type !== 'personal') return null
  return uid
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const uid = session.id
    const { listId, listName, name, accountId } = await request.json()

    if (!listId || !name?.trim()) {
      return NextResponse.json({ error: 'listId and name required' }, { status: 400 })
    }

    // Verify access to parent list
    const listRes = await db.query('SELECT * FROM transaction_lists WHERE id = $1', [listId])
    const list = listRes.rows[0] as { userId: string | null } | undefined
    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })
    if (list.userId !== null && list.userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const groupUserId = await resolveGroupUserId(db, accountId, uid)

    const now = new Date().toISOString()
    const id = uuidv4()
    const maxRes = await db.query(`SELECT MAX("sortOrder") as m FROM transaction_groups WHERE "listId" = $1`, [listId])
    const maxOrder = (maxRes.rows[0].m as number | null) ?? -1

    await db.query(
      `INSERT INTO transaction_groups (id, "listId", "listName", name, "userId", "sortOrder", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, listId, listName, name.trim(), groupUserId, maxOrder + 1, now, now]
    )

    const result = await db.query('SELECT * FROM transaction_groups WHERE id = $1', [id])
    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const uid = session.id
    const { id, name, makeGlobal } = await request.json() as {
      id: string; name?: string; makeGlobal?: boolean
    }

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const oldRes = await db.query(`
      SELECT tg.*, tl."userId" as "listUserId"
      FROM transaction_groups tg
      JOIN transaction_lists tl ON tl.id = tg."listId"
      WHERE tg.id = $1`, [id])
    const old = oldRes.rows[0] as { name: string; listName: string; userId: string | null; listUserId: string | null } | undefined
    if (!old) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Global groups (userId=null) can be claimed as private; owned groups require matching uid
    if (old.userId !== null && old.userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const sets: string[] = [`"updatedAt" = '${now}'`]
    const params: unknown[] = []
    const add = (v: unknown) => { params.push(v); return `$${params.length}` }

    if (name?.trim()) {
      sets.push(`name = ${add(name.trim())}`)
    }
    if (makeGlobal === true)  sets.push(`"userId" = ${add(null)}`)
    if (makeGlobal === false) sets.push(`"userId" = ${add(uid)}`)

    if (sets.length === 1) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    if (name?.trim() && old) {
      await transaction(async (client) => {
        await client.query(`UPDATE transaction_groups SET ${sets.join(', ')} WHERE id = ${add(id)}`, params)
        await client.query(
          'UPDATE transactions SET "groupName" = $1 WHERE "listName" = $2 AND "groupName" = $3',
          [name.trim(), old.listName, old.name]
        )
      })
    } else {
      await db.query(`UPDATE transaction_groups SET ${sets.join(', ')} WHERE id = ${add(id)}`, params)
    }

    const result = await db.query('SELECT * FROM transaction_groups WHERE id = $1', [id])
    return NextResponse.json(result.rows[0])
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
    const uid = session.id
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const groupRes = await db.query(`
      SELECT tg.*, tl."userId" as "listUserId"
      FROM transaction_groups tg
      JOIN transaction_lists tl ON tl.id = tg."listId"
      WHERE tg.id = $1`, [id])
    const group = groupRes.rows[0] as { name: string; listName: string; userId: string | null; listUserId: string | null } | undefined

    if (group) {
      const effectiveOwner = group.userId ?? group.listUserId
      if (effectiveOwner !== null && effectiveOwner !== uid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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
