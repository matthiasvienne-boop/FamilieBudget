import { NextRequest, NextResponse } from 'next/server'
import { getDb, transaction } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { parseRevolutCSV } from '@/parsers/revolut'
import { parseCrelanCSV } from '@/parsers/crelan'
import { applyRules, buildDuplicateKey } from '@/lib/classification'
import { ClassificationRule, Transaction } from '@/types'
import { v4 as uuidv4 } from 'uuid'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const source = formData.get('source') as string | null
    const accountId = (formData.get('accountId') as string | null) || null

    if (!file) return NextResponse.json({ error: 'Geen bestand opgegeven' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Bestand te groot (max 10MB)' }, { status: 413 })
    if (!file.name.toLowerCase().endsWith('.csv')) return NextResponse.json({ error: 'Alleen CSV-bestanden zijn toegestaan' }, { status: 400 })
    if (!source || !['revolut', 'crelan'].includes(source)) {
      return NextResponse.json({ error: 'Ongeldige bankbron' }, { status: 400 })
    }

    const csvText = await file.text()
    const fileName = file.name

    const parsed = source === 'revolut'
      ? parseRevolutCSV(csvText, fileName)
      : parseCrelanCSV(csvText, fileName)

    const [rulesRes, existingRes] = await Promise.all([
      db.query('SELECT * FROM classification_rules WHERE "applyToFutureImports" = true ORDER BY priority DESC'),
      db.query('SELECT source, "transactionDate", amount, description, counterparty FROM transactions WHERE "isDeleted" = false'),
    ])

    const rules = rulesRes.rows as ClassificationRule[]
    const existingKeys = new Set((existingRes.rows as Partial<Transaction>[]).map(buildDuplicateKey))

    let imported = 0
    let duplicates = 0
    const errors: string[] = []

    await transaction(async (client) => {
      for (const tx of parsed) {
        try {
          const key = buildDuplicateKey(tx)
          if (existingKeys.has(key)) { duplicates++; continue }

          const classified = applyRules(tx, rules)
          existingKeys.add(key)

          await client.query(`
            INSERT INTO transactions (
              id, source, "sourceFileName", "sourceTransactionId",
              "transactionDate", "completedDate", description, counterparty, merchant,
              amount, currency, fees, "balanceAfterTransaction",
              "transactionType", "productOrAccount", status, direction,
              "listName", "groupName", "isRecurring", "recurringType",
              "recurringEndType", "recurringEndDate", notes, "isSplit", "isDeleted",
              "createdAt", "updatedAt", "rawData", "accountId"
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
            )
          `, [
            classified.id, classified.source, classified.sourceFileName,
            classified.sourceTransactionId ?? null, classified.transactionDate,
            classified.completedDate ?? null, classified.description,
            classified.counterparty ?? null, classified.merchant ?? null,
            classified.amount, classified.currency, classified.fees ?? 0,
            classified.balanceAfterTransaction ?? null, classified.transactionType ?? null,
            classified.productOrAccount ?? null, classified.status ?? null, classified.direction,
            classified.listName ?? null, classified.groupName ?? null,
            !!classified.isRecurring, classified.recurringType ?? 'one_time',
            classified.recurringEndType ?? null, classified.recurringEndDate ?? null,
            classified.notes ?? null, false, false,
            classified.createdAt, classified.updatedAt, classified.rawData ?? null, accountId,
          ])
          imported++
        } catch (e) {
          errors.push('Rij kon niet worden verwerkt')
          console.error(e)
        }
      }
    })

    await db.query(
      'INSERT INTO import_history (id, "fileName", source, "importedAt", "transactionCount", "duplicateCount") VALUES ($1,$2,$3,$4,$5,$6)',
      [uuidv4(), fileName, source, new Date().toISOString(), imported, duplicates]
    )

    return NextResponse.json({ imported, skipped: duplicates, duplicates, errors, total: parsed.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Import mislukt' }, { status: 500 })
  }
}
