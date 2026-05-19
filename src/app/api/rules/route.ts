import { NextRequest, NextResponse } from 'next/server'
import { getDb, transaction } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { matchesRule } from '@/lib/classification'
import { ClassificationRule, Transaction } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const result = await db.query('SELECT * FROM classification_rules ORDER BY priority DESC, "createdAt" DESC')
    return NextResponse.json(result.rows)
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
    const body = await request.json()
    const {
      matchType, matchValue, listName, groupName, accountId,
      isRecurring, recurringType, recurringEndType, recurringEndDate,
      applyToFutureImports, priority,
    } = body

    if (!matchType || !matchValue?.trim()) {
      return NextResponse.json({ error: 'matchType and matchValue required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const id = uuidv4()

    await db.query(`
      INSERT INTO classification_rules
        (id, "matchType", "matchValue", "listName", "groupName", "accountId", "isRecurring", "recurringType",
         "recurringEndType", "recurringEndDate", "applyToFutureImports", priority, "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `, [
      id, matchType, matchValue.trim(),
      listName ?? null, groupName ?? null, accountId ?? null,
      !!isRecurring, recurringType ?? 'one_time',
      recurringEndType ?? null, recurringEndDate ?? null,
      applyToFutureImports !== false, priority ?? 0,
      now, now,
    ])

    const ruleRes = await db.query('SELECT * FROM classification_rules WHERE id = $1', [id])
    const rule = ruleRes.rows[0] as ClassificationRule

    const unclassifiedRes = await db.query(
      `SELECT * FROM transactions WHERE "isDeleted" = false AND "listName" IS NULL`
    )
    const toUpdate = (unclassifiedRes.rows as Transaction[]).filter(tx => matchesRule(tx, rule))

    if (toUpdate.length > 0) {
      const now2 = new Date().toISOString()
      await transaction(async (client) => {
        for (const tx of toUpdate) {
          await client.query(
            `UPDATE transactions SET "listName" = $1, "groupName" = $2, "isRecurring" = $3, "recurringType" = $4, "updatedAt" = $5 WHERE id = $6`,
            [rule.listName ?? null, rule.groupName ?? null, !!rule.isRecurring, rule.recurringType, now2, tx.id]
          )
        }
      })
    }

    return NextResponse.json({ ...rule, appliedTo: toUpdate.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
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

    await db.query('DELETE FROM classification_rules WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
