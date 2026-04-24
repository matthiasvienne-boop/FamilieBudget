import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { parseRevolutCSV } from '@/parsers/revolut'
import { parseCrelanCSV } from '@/parsers/crelan'
import { applyRules, buildDuplicateKey } from '@/lib/classification'
import { ClassificationRule, Transaction } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const source = formData.get('source') as string | null

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (!source || !['revolut', 'crelan'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
    }

    const csvText = await file.text()
    const fileName = file.name

    // Parse CSV
    const parsed = source === 'revolut'
      ? parseRevolutCSV(csvText, fileName)
      : parseCrelanCSV(csvText, fileName)

    // Load active rules
    const rules = db.prepare(
      'SELECT * FROM classification_rules WHERE applyToFutureImports = 1 ORDER BY priority DESC'
    ).all() as ClassificationRule[]

    // Build duplicate keys from existing transactions
    const existing = db.prepare(
      'SELECT source, transactionDate, amount, description, counterparty FROM transactions WHERE isDeleted = 0'
    ).all() as Partial<Transaction>[]

    const existingKeys = new Set(existing.map(buildDuplicateKey))

    let imported = 0
    let duplicates = 0
    const errors: string[] = []

    const insertTx = db.prepare(`
      INSERT INTO transactions (
        id, source, sourceFileName, sourceTransactionId,
        transactionDate, completedDate, description, counterparty, merchant,
        amount, currency, fees, balanceAfterTransaction,
        transactionType, productOrAccount, status, direction,
        listName, groupName, isRecurring, recurringType,
        recurringEndType, recurringEndDate, notes, isDeleted,
        createdAt, updatedAt, rawData
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `)

    const insertMany = db.transaction((transactions: Partial<Transaction>[]) => {
      for (const tx of transactions) {
        try {
          const key = buildDuplicateKey(tx)
          if (existingKeys.has(key)) {
            duplicates++
            continue
          }

          const classified = applyRules(tx, rules)
          existingKeys.add(key)

          insertTx.run(
            classified.id,
            classified.source,
            classified.sourceFileName,
            classified.sourceTransactionId ?? null,
            classified.transactionDate,
            classified.completedDate ?? null,
            classified.description,
            classified.counterparty ?? null,
            classified.merchant ?? null,
            classified.amount,
            classified.currency,
            classified.fees ?? 0,
            classified.balanceAfterTransaction ?? null,
            classified.transactionType ?? null,
            classified.productOrAccount ?? null,
            classified.status ?? null,
            classified.direction,
            classified.listName ?? null,
            classified.groupName ?? null,
            classified.isRecurring ? 1 : 0,
            classified.recurringType ?? 'one_time',
            classified.recurringEndType ?? null,
            classified.recurringEndDate ?? null,
            classified.notes ?? null,
            0,
            classified.createdAt,
            classified.updatedAt,
            classified.rawData ?? null
          )
          imported++
        } catch (e) {
          errors.push(String(e))
        }
      }
    })

    insertMany(parsed)

    // Log import history
    db.prepare(
      'INSERT INTO import_history (id, fileName, source, importedAt, transactionCount, duplicateCount) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), fileName, source, new Date().toISOString(), imported, duplicates)

    return NextResponse.json({
      imported,
      skipped: duplicates,
      duplicates,
      errors,
      total: parsed.length,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Import failed: ' + String(error) }, { status: 500 })
  }
}
