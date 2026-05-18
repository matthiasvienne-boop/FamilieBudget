import { NextResponse } from 'next/server'
import { getDb, transaction } from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { matchesRule } from '@/lib/classification'
import { ClassificationRule, Transaction } from '@/types'

export async function POST() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const db = await getDb()

    const [rulesRes, unclassifiedRes] = await Promise.all([
      db.query('SELECT * FROM classification_rules ORDER BY priority DESC, "createdAt" DESC'),
      db.query(`SELECT * FROM transactions WHERE "isDeleted" = false AND "listName" IS NULL`),
    ])

    const rules = rulesRes.rows as ClassificationRule[]
    const unclassified = unclassifiedRes.rows as Transaction[]
    const now = new Date().toISOString()

    let applied = 0

    await transaction(async (client) => {
      for (const tx of unclassified) {
        for (const rule of rules) {
          if (matchesRule(tx, rule)) {
            await client.query(
              `UPDATE transactions SET "listName" = $1, "groupName" = $2, "isRecurring" = $3, "recurringType" = $4, "updatedAt" = $5 WHERE id = $6`,
              [rule.listName ?? null, rule.groupName ?? null, !!rule.isRecurring, rule.recurringType, now, tx.id]
            )
            applied++
            break
          }
        }
      }
    })

    return NextResponse.json({ applied, total: unclassified.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
