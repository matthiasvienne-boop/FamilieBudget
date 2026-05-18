import { NextRequest, NextResponse } from 'next/server'
import { getDb, transaction } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { applyRules, buildDuplicateKey } from '@/lib/classification'
import { ClassificationRule, Transaction } from '@/types'
import { v4 as uuidv4 } from 'uuid'

const MAX_FILE_SIZE = 10 * 1024 * 1024

type FieldMapping = Record<string, string | null>

function parseRow(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' || ch === "'") { inQuote = !inQuote }
    else if (ch === delimiter && !inQuote) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

function parseAmount(val: string): number | null {
  if (!val) return null
  const cleaned = val.replace(/[€$£\s]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseDate(val: string): string | null {
  if (!val) return null
  const dmy = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  const ymd = val.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  return val
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const mappingRaw = formData.get('mapping') as string | null
    const delimiterRaw = formData.get('delimiter') as string | null

    if (!file) return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Bestand te groot (max 10MB)' }, { status: 413 })
    if (!mappingRaw) return NextResponse.json({ error: 'Geen veldmapping opgegeven' }, { status: 400 })

    const mapping: FieldMapping = JSON.parse(mappingRaw)
    const delimiter = delimiterRaw || ','

    if (!Object.values(mapping).includes('transactionDate') || !Object.values(mapping).includes('amount')) {
      return NextResponse.json({ error: 'Datum en bedrag zijn verplicht in de mapping' }, { status: 400 })
    }

    const csvText = await file.text()
    const lines = csvText.split('\n').filter(l => l.trim())
    if (lines.length < 2) return NextResponse.json({ error: 'Geen data gevonden' }, { status: 400 })

    const headers = parseRow(lines[0], delimiter)
    const headerIndex: Record<string, number> = {}
    headers.forEach((h, i) => { headerIndex[h] = i })

    const [rulesRes, existingRes] = await Promise.all([
      db.query('SELECT * FROM classification_rules WHERE "applyToFutureImports" = true ORDER BY priority DESC'),
      db.query('SELECT source, "transactionDate", amount, description, counterparty FROM transactions WHERE "isDeleted" = false'),
    ])

    const rules = rulesRes.rows as ClassificationRule[]
    const existingKeys = new Set((existingRes.rows as Partial<Transaction>[]).map(buildDuplicateKey))

    let imported = 0
    let duplicates = 0
    const errors: string[] = []
    const fileName = file.name
    const now = new Date().toISOString()

    const getField = (row: string[], field: string): string => {
      const csvHeader = Object.entries(mapping).find(([, f]) => f === field)?.[0]
      if (!csvHeader) return ''
      const idx = headerIndex[csvHeader]
      return idx !== undefined ? (row[idx] || '') : ''
    }

    await transaction(async (client) => {
      for (let i = 1; i < lines.length; i++) {
        try {
          const row = parseRow(lines[i], delimiter)
          if (row.every(c => !c)) continue

          const amount = parseAmount(getField(row, 'amount'))
          const transactionDate = parseDate(getField(row, 'transactionDate'))
          if (amount === null || !transactionDate) continue

          const direction = amount >= 0 ? 'income' : 'expense'
          const description = getField(row, 'description') || getField(row, 'counterparty') || `Rij ${i}`

          const txPartial: Partial<Transaction> = {
            source: 'generic' as Transaction['source'],
            transactionDate,
            amount,
            description,
            counterparty: getField(row, 'counterparty') || null,
            merchant: getField(row, 'merchant') || null,
          }

          const key = buildDuplicateKey(txPartial)
          if (existingKeys.has(key)) { duplicates++; continue }

          const classified = applyRules({
            ...txPartial,
            id: uuidv4(),
            sourceFileName: fileName,
            sourceTransactionId: null,
            completedDate: parseDate(getField(row, 'completedDate')) || null,
            currency: getField(row, 'currency') || 'EUR',
            fees: 0,
            balanceAfterTransaction: parseAmount(getField(row, 'balanceAfterTransaction')),
            transactionType: getField(row, 'transactionType') || null,
            productOrAccount: null,
            status: null,
            direction: direction as Transaction['direction'],
            listName: null,
            groupName: null,
            isRecurring: false,
            recurringType: 'one_time',
            recurringEndType: null,
            recurringEndDate: null,
            notes: getField(row, 'notes') || null,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
            rawData: JSON.stringify(row),
          }, rules)

          existingKeys.add(key)

          await client.query(`
            INSERT INTO transactions (
              id, source, "sourceFileName", "sourceTransactionId",
              "transactionDate", "completedDate", description, counterparty, merchant,
              amount, currency, fees, "balanceAfterTransaction",
              "transactionType", "productOrAccount", status, direction,
              "listName", "groupName", "isRecurring", "recurringType",
              "recurringEndType", "recurringEndDate", notes, "isSplit", "isDeleted",
              "createdAt", "updatedAt", "rawData"
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
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
            classified.createdAt, classified.updatedAt, classified.rawData ?? null,
          ])
          imported++
        } catch (e) {
          errors.push(`Rij ${i} overgeslagen`)
          console.error(e)
        }
      }
    })

    await db.query(
      'INSERT INTO import_history (id, "fileName", source, "importedAt", "transactionCount", "duplicateCount") VALUES ($1,$2,$3,$4,$5,$6)',
      [uuidv4(), fileName, 'generic', now, imported, duplicates]
    )

    return NextResponse.json({ imported, skipped: duplicates, duplicates, errors, total: lines.length - 1 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Import mislukt' }, { status: 500 })
  }
}
