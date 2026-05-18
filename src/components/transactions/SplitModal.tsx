'use client'

import { useEffect, useState } from 'react'
import { Transaction, TransactionList, TransactionGroup } from '@/types'
import Modal from '@/components/ui/Modal'
import { Plus, Trash2 } from 'lucide-react'
import { formatEuro } from '@/lib/utils'
import clsx from 'clsx'

interface SplitLine {
  listName: string
  groupName: string
  amount: string
  note: string
}

interface SplitModalProps {
  transaction: Transaction
  lists: TransactionList[]
  groups: TransactionGroup[]
  onClose: () => void
  onSaved: () => void
}

const emptyLine = (): SplitLine => ({ listName: '', groupName: '', amount: '', note: '' })

export default function SplitModal({ transaction, lists, groups, onClose, onSaved }: SplitModalProps) {
  const [lines, setLines] = useState<SplitLine[]>([emptyLine(), emptyLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = Math.abs(transaction.amount)

  useEffect(() => {
    // Load existing splits if any
    if (transaction.isSplit) {
      fetch(`/api/splits?transactionId=${transaction.id}`)
        .then(r => r.json())
        .then((splits: { listName: string | null; groupName: string | null; amount: number; note: string | null }[]) => {
          if (splits.length > 0) {
            setLines(splits.map(s => ({
              listName: s.listName || '',
              groupName: s.groupName || '',
              amount: String(Math.abs(s.amount)),
              note: s.note || '',
            })))
          }
        })
    }
  }, [transaction.id, transaction.isSplit])

  const filteredGroups = (listName: string) => groups.filter(g => g.listName === listName)

  const allocated = lines.reduce((s, l) => {
    const v = parseFloat(l.amount.replace(',', '.'))
    return s + (isNaN(v) ? 0 : v)
  }, 0)
  const remaining = Math.round((total - allocated) * 100) / 100

  const updateLine = (idx: number, field: keyof SplitLine, value: string) => {
    setLines(prev => prev.map((l, i) => i === idx
      ? { ...l, [field]: value, ...(field === 'listName' ? { groupName: '' } : {}) }
      : l
    ))
  }

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

  const distributeRemaining = () => {
    if (remaining === 0) return
    // Add remaining to last unfilled line, or add new line
    const emptyIdx = lines.findIndex(l => !l.amount)
    if (emptyIdx >= 0) {
      updateLine(emptyIdx, 'amount', String(remaining))
    } else {
      setLines(prev => [...prev, { ...emptyLine(), amount: String(remaining) }])
    }
  }

  const handleSave = async () => {
    setError('')
    const parsed = lines.map(l => ({
      ...l,
      amount: parseFloat(l.amount.replace(',', '.')),
    }))

    const invalid = parsed.some(l => isNaN(l.amount) || l.amount <= 0)
    if (invalid) { setError('Alle bedragen moeten ingevuld zijn.'); return }

    const sum = parsed.reduce((s, l) => s + l.amount, 0)
    if (Math.abs(sum - total) > 0.01) {
      setError(`Totaal klopt niet: ${formatEuro(sum)} ≠ ${formatEuro(total)}`)
      return
    }

    setSaving(true)
    const res = await fetch('/api/splits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: transaction.id,
        splits: parsed.map(l => ({
          listName: l.listName || null,
          groupName: l.groupName || null,
          amount: l.amount,
          note: l.note || null,
        })),
      }),
    })
    setSaving(false)
    if (res.ok) onSaved()
    else setError('Opslaan mislukt')
  }

  const handleRemoveSplit = async () => {
    if (!confirm('Splitsing verwijderen en transactie terugzetten?')) return
    await fetch(`/api/splits?transactionId=${transaction.id}`, { method: 'DELETE' })
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title="Transactie splitsen" size="lg">
      <div className="space-y-4">
        {/* Transaction info */}
        <div className="bg-slate-50 rounded-xl p-3 text-sm">
          <div className="font-medium text-slate-800">
            {transaction.merchant || transaction.counterparty || transaction.description}
          </div>
          <div className="text-slate-500 mt-0.5">
            {transaction.transactionDate} · <span className="font-semibold text-red-600">{formatEuro(total)}</span> te verdelen
          </div>
        </div>

        {/* Split lines */}
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_100px_auto] gap-2 items-start">
              {/* List */}
              <select
                value={line.listName}
                onChange={e => updateLine(idx, 'listName', e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white"
              >
                <option value="">— Lijst —</option>
                {lists.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>

              {/* Group */}
              <select
                value={line.groupName}
                onChange={e => updateLine(idx, 'groupName', e.target.value)}
                disabled={!line.listName}
                className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white disabled:opacity-40"
              >
                <option value="">— Groep —</option>
                {filteredGroups(line.listName).map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
              </select>

              {/* Amount */}
              <input
                type="number"
                step="0.01"
                min="0"
                value={line.amount}
                onChange={e => updateLine(idx, 'amount', e.target.value)}
                placeholder="€ 0.00"
                className="border border-slate-200 rounded-lg px-2 py-2 text-sm text-right"
              />

              {/* Remove */}
              <button
                onClick={() => removeLine(idx)}
                disabled={lines.length <= 2}
                className="p-2 text-slate-300 hover:text-red-500 disabled:opacity-20"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {/* Add line */}
        <button
          onClick={() => setLines(prev => [...prev, emptyLine()])}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus size={13} /> Rubriek toevoegen
        </button>

        {/* Remaining indicator */}
        <div className={clsx(
          'flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium',
          Math.abs(remaining) < 0.01 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        )}>
          <span>{Math.abs(remaining) < 0.01 ? '✓ Volledig verdeeld' : `Nog te verdelen`}</span>
          <div className="flex items-center gap-3">
            <span className="font-bold">{formatEuro(Math.abs(remaining))}</span>
            {remaining > 0.01 && (
              <button
                onClick={distributeRemaining}
                className="text-xs bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg"
              >
                Toevoegen
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {transaction.isSplit && (
            <button
              onClick={handleRemoveSplit}
              className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium"
            >
              Splitsing verwijderen
            </button>
          )}
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium text-sm">
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving || Math.abs(remaining) > 0.01}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm disabled:opacity-60"
          >
            {saving ? 'Opslaan...' : 'Splitsing opslaan'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
