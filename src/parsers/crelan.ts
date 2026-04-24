import { v4 as uuidv4 } from 'uuid'
import { Transaction, Direction } from '@/types'

interface CrelanRow {
  transactienummer: string
  datum: string
  omschrijving: string
  tegenpartij: string
  bedrag: string
}

function parseCSVLine(line: string): string[] {
  // Remove surrounding quotes from the whole line if present
  const trimmed = line.trim()
  const unwrapped = trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1)
    : trimmed

  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < unwrapped.length; i++) {
    const ch = unwrapped[i]
    if (ch === '"') {
      if (inQuotes && unwrapped[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCrelanAmount(val: string): number {
  if (!val || val.trim() === '') return 0
  // Crelan amounts can have spaces and use +/- prefix: " -235.98" or "+250.00"
  const cleaned = val.replace(/\s/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

function parseCrelanDate(val: string): string {
  if (!val) return ''
  // Format: "2026-01-02" — already ISO
  return val.trim()
}

function detectCrelanDirection(amount: number, description: string, counterparty: string): Direction {
  const desc = description.toLowerCase()
  const cp = counterparty.toLowerCase()

  // Internal transfers between own accounts
  if (
    desc.includes('revolut') ||
    desc.includes('instantoverschrijving') ||
    desc.includes('doorlopende betalingsopdracht') ||
    cp.includes('revolut') ||
    cp.includes('matthias vienne') ||
    cp.includes('krystle') ||
    cp.includes('vienne - van eeghem') ||
    desc.includes('vienne - van eeghem')
  ) {
    // Could be transfer to own account
    if (cp.includes('revolut') || desc.includes('revolut')) return 'transfer'
    if (cp.includes('matthias vienne') || cp.includes('vienne - van eeghem')) return 'transfer'
  }

  return amount >= 0 ? 'income' : 'expense'
}

export function parseCrelanCSV(
  csvText: string,
  fileName: string
): Partial<Transaction>[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  // Parse header line
  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine)

  const transactions: Partial<Transaction>[] = []
  const now = new Date().toISOString()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)

    // Skip if not enough columns
    if (values.length < 4) continue

    const row: CrelanRow = {
      transactienummer: '',
      datum: '',
      omschrijving: '',
      tegenpartij: '',
      bedrag: '',
    }

    headers.forEach((h, idx) => {
      const key = h.replace(/^"|"$/g, '').trim() as keyof CrelanRow
      if (key in row) {
        row[key] = (values[idx] || '').replace(/^"|"$/g, '').trim()
      }
    })

    if (!row.datum || !row.bedrag) continue

    const amount = parseCrelanAmount(row.bedrag)
    const description = row.omschrijving || ''
    const counterparty = row.tegenpartij || ''
    const direction = detectCrelanDirection(amount, description, counterparty)

    const tx: Partial<Transaction> = {
      id: uuidv4(),
      source: 'crelan',
      sourceFileName: fileName,
      sourceTransactionId: row.transactienummer || null,
      transactionDate: parseCrelanDate(row.datum),
      completedDate: null,
      description,
      counterparty: counterparty || null,
      merchant: null,
      amount,
      currency: 'EUR',
      fees: 0,
      balanceAfterTransaction: null,
      transactionType: null,
      productOrAccount: null,
      status: null,
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
