import { NextRequest, NextResponse } from 'next/server'
import { getDb, transaction } from '@/lib/db'
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

  const db = await getDb()
  const result = await db.query(
    `SELECT * FROM transaction_splits WHERE "transactionId" = $1 ORDER BY "createdAt"`,
    [transactionId]
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const db = await getDb()
    const { transactionId, splits }: { transactionId: string; splits: SplitInput[] } = await request.json()

    if (!transactionId || !splits?.length) {
      return NextResponse.json({ error: 'transactionId and splits required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    await transaction(async (client) => {
      await client.query('DELETE FROM transaction_splits WHERE "transactionId" = $1', [transactionId])
      for (const s of splits) {
        await client.query(
          `INSERT INTO transaction_splits (id, "transactionId", "listName", "groupName", amount, note, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uuidv4(), transactionId, s.listName ?? null, s.groupName ?? null, s.amount, s.note ?? null, now, now]
        )
      }
      await client.query(
        `UPDATE transactions SET "isSplit" = true, "listName" = NULL, "groupName" = NULL, "updatedAt" = $1 WHERE id = $2`,
        [now, transactionId]
      )
    })

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
    const db = await getDb()
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')
    if (!transactionId) return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 })

    const now = new Date().toISOString()
    await transaction(async (client) => {
      await client.query('DELETE FROM transaction_splits WHERE "transactionId" = $1', [transactionId])
      await client.query(`UPDATE transactions SET "isSplit" = false, "updatedAt" = $1 WHERE id = $2`, [now, transactionId])
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
