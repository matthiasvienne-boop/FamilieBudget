import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { matchesRule } from '@/lib/classification'
import { ClassificationRule, Transaction } from '@/types'

export async function POST() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const db = getDb()

    const rules = db.prepare(
      'SELECT * FROM classification_rules ORDER BY priority DESC, createdAt DESC'
    ).all() as ClassificationRule[]

    const unclassified = db.prepare(
      "SELECT * FROM transactions WHERE isDeleted = 0 AND listName IS NULL"
    ).all() as Transaction[]

    const now = new Date().toISOString()
    const update = db.prepare(
      'UPDATE transactions SET listName = ?, groupName = ?, isRecurring = ?, recurringType = ?, updatedAt = ? WHERE id = ?'
    )

    let applied = 0
    const applyAll = db.transaction(() => {
      for (const tx of unclassified) {
        for (const rule of rules) {
          if (matchesRule(tx, rule)) {
            update.run(rule.listName ?? null, rule.groupName ?? null, rule.isRecurring ? 1 : 0, rule.recurringType, now, tx.id)
            applied++
            break
          }
        }
      }
    })
    applyAll()

    return NextResponse.json({ applied, total: unclassified.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
