import { NextRequest, NextResponse } from 'next/server'
import { getDb, transaction } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

// Returns accounts the current user has access to, with their members
export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error

  const db = await getDb()
  const result = await db.query(`
    SELECT a.*,
      json_agg(json_build_object(
        'userId', am."userId",
        'isOwner', am."isOwner",
        'userName', u.name,
        'userEmail', u.email
      )) FILTER (WHERE am."userId" IS NOT NULL) as members
    FROM accounts a
    LEFT JOIN account_members am ON am."accountId" = a.id
    LEFT JOIN users u ON u.id = am."userId"
    WHERE a."isActive" = true
      AND (
        NOT EXISTS (SELECT 1 FROM account_members am2 WHERE am2."accountId" = a.id)
        OR EXISTS (SELECT 1 FROM account_members am3 WHERE am3."accountId" = a.id AND am3."userId" = $1)
      )
    GROUP BY a.id
    ORDER BY a."createdAt" ASC
  `, [session.id])

  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  const db = await getDb()
  const { name, iban, bank, type, color, currency, memberIds } = await request.json()

  if (!name?.trim()) return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })

  const now = new Date().toISOString()
  const id = uuidv4()

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO accounts (id, name, iban, bank, type, color, currency, "isActive", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9)`,
      [id, name.trim(), iban?.trim() || null, bank?.trim() || null, type || 'shared', color || '#3b82f6', currency || 'EUR', now, now]
    )

    // Add members: the creator is always owner, plus any additional members
    const allMemberIds: string[] = Array.from(new Set([session.id, ...(memberIds || [])]))
    for (const userId of allMemberIds) {
      await client.query(
        `INSERT INTO account_members ("accountId", "userId", "isOwner") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [id, userId, userId === session.id]
      )
    }
  })

  const result = await db.query(`
    SELECT a.*,
      json_agg(json_build_object('userId', am."userId", 'isOwner', am."isOwner", 'userName', u.name, 'userEmail', u.email)) as members
    FROM accounts a
    LEFT JOIN account_members am ON am."accountId" = a.id
    LEFT JOIN users u ON u.id = am."userId"
    WHERE a.id = $1
    GROUP BY a.id
  `, [id])

  return NextResponse.json(result.rows[0])
}

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  const db = await getDb()
  const { id, name, iban, bank, type, color, currency, memberIds } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Only owners can edit
  const ownerCheck = await db.query(
    `SELECT 1 FROM account_members WHERE "accountId" = $1 AND "userId" = $2 AND "isOwner" = true`,
    [id, session.id]
  )
  if (ownerCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const params: unknown[] = []
  const add = (v: unknown) => { params.push(v); return `$${params.length}` }
  const sets: string[] = []

  if (name !== undefined) sets.push(`name = ${add(name.trim())}`)
  if (iban !== undefined) sets.push(`iban = ${add(iban?.trim() || null)}`)
  if (bank !== undefined) sets.push(`bank = ${add(bank?.trim() || null)}`)
  if (type !== undefined) sets.push(`type = ${add(type)}`)
  if (color !== undefined) sets.push(`color = ${add(color)}`)
  if (currency !== undefined) sets.push(`currency = ${add(currency)}`)
  sets.push(`"updatedAt" = ${add(now)}`)

  await transaction(async (client) => {
    if (sets.length > 1) {
      await client.query(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ${add(id)}`, params)
    }

    if (memberIds !== undefined) {
      await client.query(`DELETE FROM account_members WHERE "accountId" = $1`, [id])
      const allMemberIds: string[] = Array.from(new Set([session.id, ...memberIds]))
      for (const userId of allMemberIds) {
        await client.query(
          `INSERT INTO account_members ("accountId", "userId", "isOwner") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [id, userId, userId === session.id]
        )
      }
    }
  })

  const result = await db.query(`
    SELECT a.*,
      json_agg(json_build_object('userId', am."userId", 'isOwner', am."isOwner", 'userName', u.name, 'userEmail', u.email)) as members
    FROM accounts a
    LEFT JOIN account_members am ON am."accountId" = a.id
    LEFT JOIN users u ON u.id = am."userId"
    WHERE a.id = $1
    GROUP BY a.id
  `, [id])

  return NextResponse.json(result.rows[0])
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuth()
  if (error) return error

  const db = await getDb()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const ownerCheck = await db.query(
    `SELECT 1 FROM account_members WHERE "accountId" = $1 AND "userId" = $2 AND "isOwner" = true`,
    [id, session.id]
  )
  if (ownerCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  // Soft delete: deactivate instead of deleting
  await db.query(`UPDATE accounts SET "isActive" = false, "updatedAt" = $1 WHERE id = $2`, [new Date().toISOString(), id])
  return NextResponse.json({ success: true })
}
