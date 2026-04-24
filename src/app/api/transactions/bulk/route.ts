import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { BulkUpdatePayload } from '@/types'

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb()
    const body: BulkUpdatePayload = await request.json()
    const { ids, ...updates } = body

    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: 'No ids provided' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const placeholders = ids.map(() => '?').join(',')

    const updateData: Record<string, unknown> = {}
    if ('listName' in updates) updateData.listName = updates.listName
    if ('groupName' in updates) updateData.groupName = updates.groupName
    if ('isRecurring' in updates) updateData.isRecurring = updates.isRecurring ? 1 : 0
    if ('recurringType' in updates) updateData.recurringType = updates.recurringType
    if ('recurringEndType' in updates) updateData.recurringEndType = updates.recurringEndType
    if ('recurringEndDate' in updates) updateData.recurringEndDate = updates.recurringEndDate
    if ('notes' in updates) updateData.notes = updates.notes

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const fields = Object.keys(updateData)
      .map(k => `${k} = ?`)
      .join(', ')
    const values = Object.values(updateData)

    db.prepare(
      `UPDATE transactions SET ${fields}, updatedAt = ? WHERE id IN (${placeholders}) AND isDeleted = 0`
    ).run(...values, now, ...ids)

    return NextResponse.json({ success: true, updated: ids.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to bulk update' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { ids } = body

    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: 'No ids provided' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const placeholders = ids.map(() => '?').join(',')

    db.prepare(
      `UPDATE transactions SET isDeleted = 1, updatedAt = ? WHERE id IN (${placeholders})`
    ).run(now, ...ids)

    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to bulk delete' }, { status: 500 })
  }
}
