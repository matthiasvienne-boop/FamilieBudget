import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { description, counterparty, merchant, amount, direction } = await request.json()

    const settingRes = await db.query(`SELECT value FROM app_settings WHERE key = 'anthropic_api_key'`)
    const apiKey = settingRes.rows[0]?.value || process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Geen Anthropic API-sleutel ingesteld' }, { status: 400 })
    }

    const [listsRes, groupsRes] = await Promise.all([
      db.query('SELECT name FROM transaction_lists ORDER BY name'),
      db.query('SELECT "listName", name FROM transaction_groups ORDER BY "listName", name'),
    ])

    const lists = listsRes.rows as { name: string }[]
    const groups = groupsRes.rows as { listName: string; name: string }[]

    const listOptions = lists.map(l => {
      const listGroups = groups.filter(g => g.listName === l.name).map(g => g.name)
      return listGroups.length > 0 ? `${l.name} (groepen: ${listGroups.join(', ')})` : l.name
    }).join('\n')

    const txDescription = [merchant, counterparty, description].filter(Boolean).join(' | ')
    const amountStr = amount != null ? `€${Math.abs(amount).toFixed(2)} ${direction === 'income' ? '(inkomst)' : '(uitgave)'}` : ''

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Classificeer deze banktransactie in één van de beschikbare categorieën. Antwoord ALLEEN met JSON: {"listName": "...", "groupName": "..." of null}.

Transactie: ${txDescription} ${amountStr}

Beschikbare categorieën:
${listOptions}

JSON antwoord:`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[^}]+\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Kon geen suggestie genereren' }, { status: 500 })

    try {
      return NextResponse.json(JSON.parse(jsonMatch[0]))
    } catch {
      return NextResponse.json({ error: 'Ongeldige AI-respons' }, { status: 500 })
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Classificatie mislukt' }, { status: 500 })
  }
}
