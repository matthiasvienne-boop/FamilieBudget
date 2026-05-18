import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { v4 as uuidv4 } from 'uuid'

interface SplitInput {
  listName: string | null
  groupName: string | null
  amount: number
  note: string | null
}

export async function GET(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const transactionId = searchParams.get('transactionId')
  if (!transactionId) return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 })

  const db = getDb()
  const splits = db.prepare('SELECT * FROM transaction_splits WHERE transactionId = ? ORDER BY rowid').all(transactionId)
  return NextResponse.json(splits)
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = getDb()
    const { transactionId, splits }: { transactionId: string; splits: SplitInput[] } = await request.json()

    if (!transactionId || !splits?.length) {
      return NextResponse.json({ error: 'transactionId and splits required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    db.transaction(() => {
      // Remove existing splits
      db.prepare('DELETE FROM transaction_splits WHERE transactionId = ?').run(transactionId)

      // Insert new splits
      const insert = db.prepare(
        'INSERT INTO transaction_splits (id, transactionId, listName, groupName, amount, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      for (const s of splits) {
        insert.run(uuidv4(), transactionId, s.listName ?? null, s.groupName ?? null, s.amount, s.note ?? null, now, now)
      }

      // Mark transaction as split, clear listName/groupName
      db.prepare('UPDATE transactions SET isSplit = 1, listName = NULL, groupName = NULL, updatedAt = ? WHERE id = ?').run(now, transactionId)
    })()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')
    if (!transactionId) return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 })

    const now = new Date().toISOString()
    db.transaction(() => {
      db.prepare('DELETE FROM transaction_splits WHERE transactionId = ?').run(transactionId)
      db.prepare('UPDATE transactions SET isSplit = 0, updatedAt = ? WHERE id = ?').run(now, transactionId)
    })()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
