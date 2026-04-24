import { v4 as uuidv4 } from 'uuid'
import { Transaction, Direction } from '@/types'

interface RevolutRow {
  Type: string
  Product: string
  Startdatum: string
  'Datum voltooid': string
  Beschrijving: string
  Bedrag: string
  Kosten: string
  Valuta: string
  Status: string
  Saldo: string
  [key: string]: string
}

function parseAmount(val: string): number {
  if (!val || val.trim() === '') return 0
  return parseFloat(val.replace(',', '.')) || 0
}

function parseDate(val: string): string | null {
  if (!val || val.trim() === '') return null
  // Format: "2025-11-03 11:51:05" -> "2025-11-03"
  return val.split(' ')[0] || null
}

function detectDirection(amount: number, type: string, description: string): Direction {
  const desc = description.toLowerCase()
  const t = type.toLowerCase()

  if (
    t.includes('overschrijving') ||
    t.includes('wisselen') ||
    desc.includes('dagelijkse spaarrekening') ||
    desc.includes('spaarrekening')
  ) {
    return 'transfer'
  }

  return amount >= 0 ? 'income' : 'expense'
}

function extractMerchant(description: string, type: string): string | null {
  const t = type.toLowerCase()
  if (t.includes('kaartbetaling') || t.includes('rev-betaling')) {
    return description.trim() || null
  }
  return null
}

export function parseRevolutCSV(
  csvText: string,
  fileName: string
): Partial<Transaction>[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const transactions: Partial<Transaction>[] = []
  const now = new Date().toISOString()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const row: RevolutRow = {} as RevolutRow
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim()
    })

    if (!row['Datum voltooid'] && !row['Startdatum']) continue
    if (row['Status'] === 'ONGEDAAN GEMAAKT') continue

    const amount = parseAmount(row['Bedrag'])
    const fees = parseAmount(row['Kosten'])
    const balance = parseAmount(row['Saldo'])
    const description = row['Beschrijving'] || ''
    const transactionType = row['Type'] || ''

    const direction = detectDirection(amount, transactionType, description)

    const tx: Partial<Transaction> = {
      id: uuidv4(),
      source: 'revolut',
      sourceFileName: fileName,
      sourceTransactionId: row['Startdatum'] || null,
      transactionDate: parseDate(row['Startdatum']) || parseDate(row['Datum voltooid']) || '',
      completedDate: parseDate(row['Datum voltooid']),
      description,
      counterparty: null,
      merchant: extractMerchant(description, transactionType),
      amount,
      currency: row['Valuta'] || 'EUR',
      fees,
      balanceAfterTransaction: balance || null,
      transactionType,
      productOrAccount: row['Product'] || null,
      status: row['Status'] || null,
      direction,
      listName: null,
      groupName: null,
      isRecurring: false,
      recurringType: 'one_time',
      recurringEndType: null,
      recurringEndDate: null,
      notes: null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      rawData: JSON.stringify(row),
    }

    transactions.push(tx)
  }

  return transactions
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
