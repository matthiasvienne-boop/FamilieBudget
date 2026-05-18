import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import Anthropic from '@anthropic-ai/sdk'

const MAX_FILE_SIZE = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Geen bestand opgegeven' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Bestand te groot (max 5MB)' }, { status: 413 })

    const csvText = await file.text()
    const lines = csvText.split('\n').filter(l => l.trim())
    if (lines.length < 2) return NextResponse.json({ error: 'CSV heeft te weinig rijen' }, { status: 400 })

    const firstLine = lines[0]
    const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ','
    const parseRow = (line: string) => line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''))
    const headers = parseRow(lines[0])
    const sampleRows = lines.slice(1, 4).map(parseRow)

    const settingRes = await db.query(`SELECT value FROM app_settings WHERE key = 'anthropic_api_key'`)
    const apiKey = settingRes.rows[0]?.value || process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json({ headers, sampleRows, delimiter, aiMapping: {}, aiError: 'Geen Anthropic API-sleutel' })
    }

    const sampleText = [headers.join(' | '), ...sampleRows.map(r => r.join(' | '))].join('\n')

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyseer deze CSV-headers en voorbeelddata van een bankexport en map elke kolom naar het juiste transactieveld.

CSV headers en voorbeelddata:
${sampleText}

Beschikbare transactievelden (gebruik exact deze namen of null):
- transactionDate (datum van de transactie, verplicht)
- amount (bedrag, verplicht - negatief voor uitgaven, positief voor inkomsten)
- description (omschrijving)
- counterparty (naam van tegenpartij / begunstigde)
- merchant (handelaar)
- currency (valuta, bv EUR)
- completedDate (verwerkingsdatum)
- balanceAfterTransaction (saldo na transactie)
- transactionType (type transactie)
- notes (notities)

Antwoord ALLEEN met een JSON object waarbij elke CSV-kolomnaam gemapd is naar een transactieveld of null.
Voorbeeld: {"Datum": "transactionDate", "Bedrag": "amount", "Omschrijving": "description", "Naam": "counterparty", "Saldo": "balanceAfterTransaction"}

JSON:`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    let aiMapping: Record<string, string | null> = {}
    if (jsonMatch) {
      try { aiMapping = JSON.parse(jsonMatch[0]) } catch { /* fallback to empty */ }
    }

    return NextResponse.json({ headers, sampleRows, delimiter, aiMapping })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Analyse mislukt' }, { status: 500 })
  }
}
