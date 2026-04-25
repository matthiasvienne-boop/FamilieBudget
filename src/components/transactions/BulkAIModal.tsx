'use client'

import { useEffect, useState } from 'react'
import { Transaction, TransactionList, TransactionGroup } from '@/types'
import { Sparkles, Check, X, ChevronRight, SkipForward } from 'lucide-react'
import clsx from 'clsx'

interface Suggestion {
  listName: string | null
  groupName: string | null
}

interface Item {
  tx: Transaction
  suggestion: Suggestion | null
  status: 'pending' | 'loading' | 'done' | 'skipped' | 'error'
  selectedList: string
  selectedGroup: string
}

interface BulkAIModalProps {
  txIds: string[]
  transactions: Transaction[]
  lists: TransactionList[]
  groups: TransactionGroup[]
  onClose: () => void
  onDone: () => void
}

export default function BulkAIModal({ txIds, transactions, lists, groups, onClose, onDone }: BulkAIModalProps) {
  const [items, setItems] = useState<Item[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [finished, setFinished] = useState(false)

  const filteredGroups = (listName: string) => groups.filter(g => g.listName === listName)

  useEffect(() => {
    const txs = txIds
      .map(id => transactions.find(t => t.id === id))
      .filter(Boolean) as Transaction[]

    setItems(txs.map(tx => ({
      tx,
      suggestion: null,
      status: 'pending',
      selectedList: tx.listName || '',
      selectedGroup: tx.groupName || '',
    })))
  }, [txIds, transactions])

  useEffect(() => {
    if (!items.length) return
    const item = items[currentIdx]
    if (!item || item.status !== 'pending') return
    getSuggestion(currentIdx)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, items.length])

  const getSuggestion = async (idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'loading' } : it))
    try {
      const tx = items[idx].tx
      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: tx.description,
          counterparty: tx.counterparty,
          merchant: tx.merchant,
          amount: tx.amount,
          direction: tx.direction,
        }),
      })
      if (res.ok) {
        const suggestion: Suggestion = await res.json()
        setItems(prev => prev.map((it, i) => i === idx ? {
          ...it,
          suggestion,
          status: 'done',
          selectedList: suggestion.listName || it.selectedList,
          selectedGroup: suggestion.groupName || '',
        } : it))
      } else {
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'error' } : it))
      }
    } catch {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'error' } : it))
    }
  }

  const handleSave = async () => {
    const item = items[currentIdx]
    if (!item) return
    setSaving(true)
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.tx.id,
        listName: item.selectedList || null,
        groupName: item.selectedGroup || null,
        isRecurring: item.tx.isRecurring,
        recurringType: item.tx.recurringType,
      }),
    })
    setSaving(false)
    goNext()
  }

  const handleSkip = () => {
    setItems(prev => prev.map((it, i) => i === currentIdx ? { ...it, status: 'skipped' } : it))
    goNext()
  }

  const goNext = () => {
    if (currentIdx + 1 >= items.length) {
      setFinished(true)
    } else {
      setCurrentIdx(prev => prev + 1)
    }
  }

  if (!items.length) return null

  const item = items[currentIdx]
  const progress = currentIdx / items.length

  if (finished) {
    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-lg p-6 text-center">
          <div className="text-3xl mb-3">✅</div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Klaar!</h2>
          <p className="text-slate-500 text-sm mb-5">{items.length} transacties verwerkt.</p>
          <button onClick={onDone} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
            Sluiten
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-500" />
            <span className="font-semibold text-slate-900">AI-classificatie</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{currentIdx + 1} / {items.length}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="p-4 space-y-4">
          {/* Transaction info */}
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="font-medium text-slate-800 text-sm">
              {item.tx.merchant || item.tx.counterparty || item.tx.description}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {item.tx.transactionDate} · {item.tx.amount > 0 ? '+' : ''}{item.tx.amount.toFixed(2)} {item.tx.currency}
            </div>
            {item.tx.description && item.tx.description !== (item.tx.merchant || item.tx.counterparty) && (
              <div className="text-xs text-slate-400 mt-0.5 truncate">{item.tx.description}</div>
            )}
          </div>

          {/* AI suggestion indicator */}
          {item.status === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-purple-600">
              <Sparkles size={14} className="animate-pulse" />
              <span>AI denkt na...</span>
            </div>
          )}
          {item.suggestion && item.status === 'done' && (
            <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
              <Sparkles size={12} />
              <span>Suggestie: <strong>{item.suggestion.listName}</strong>{item.suggestion.groupName ? ` / ${item.suggestion.groupName}` : ''}</span>
            </div>
          )}
          {item.status === 'error' && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Geen suggestie beschikbaar — kies zelf.
            </div>
          )}

          {/* List selector */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Lijst</label>
            <select
              value={item.selectedList}
              onChange={e => setItems(prev => prev.map((it, i) => i === currentIdx
                ? { ...it, selectedList: e.target.value, selectedGroup: '' } : it))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">— Geen categorie —</option>
              {lists.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
          </div>

          {/* Group selector */}
          {item.selectedList && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Groep</label>
              <select
                value={item.selectedGroup}
                onChange={e => setItems(prev => prev.map((it, i) => i === currentIdx
                  ? { ...it, selectedGroup: e.target.value } : it))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">— Geen groep —</option>
                {filteredGroups(item.selectedList).map(g => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSkip}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 text-sm"
            >
              <SkipForward size={14} /> Overslaan
            </button>
            <button
              onClick={handleSave}
              disabled={saving || item.status === 'loading'}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors',
                saving || item.status === 'loading'
                  ? 'bg-blue-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              <Check size={14} />
              {saving ? 'Opslaan...' : currentIdx + 1 < items.length ? 'Opslaan & volgende' : 'Opslaan & afronden'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
