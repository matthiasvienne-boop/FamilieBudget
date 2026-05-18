'use client'

import { useEffect, useState } from 'react'
import { Transaction, TransactionList, TransactionGroup } from '@/types'
import { Sparkles, Check, X, SkipForward, Plus } from 'lucide-react'
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
  onListsUpdated: (lists: TransactionList[], groups: TransactionGroup[]) => void
}

type ApplyScope = 'single' | 'all_existing' | 'all_existing_and_future'

export default function BulkAIModal({ txIds, transactions, lists, groups, onClose, onDone, onListsUpdated }: BulkAIModalProps) {
  const [items, setItems] = useState<Item[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [finished, setFinished] = useState(false)
  const [applyScope, setApplyScope] = useState<ApplyScope>('single')
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  const filteredGroups = (listName: string) => groups.filter(g => g.listName === listName)

  useEffect(() => {
    const txs = txIds
      .map(id => transactions.find(t => t.id === id))
      .filter(Boolean) as Transaction[]

    const unclassified = txs.filter(tx => !tx.listName)
    if (unclassified.length === 0) { setFinished(true); return }

    // Fetch existing rules to auto-skip already-covered transactions
    fetch('/api/rules').then(r => r.json()).then((rules: { matchType: string; matchValue: string; listName: string | null; groupName: string | null }[]) => {
      const matchesTx = (tx: Transaction) => rules.find(rule => {
        const needle = rule.matchValue.toLowerCase()
        if (rule.matchType === 'merchant_exact') return (tx.merchant ?? '').toLowerCase() === needle
        if (rule.matchType === 'counterparty_exact') return (tx.counterparty ?? '').toLowerCase() === needle
        if (rule.matchType === 'description_contains') return (tx.description ?? '').toLowerCase().includes(needle)
        return false
      })

      const items = unclassified.map(tx => {
        const rule = matchesTx(tx)
        return {
          tx,
          suggestion: null,
          status: (rule ? 'skipped' : 'pending') as Item['status'],
          selectedList: rule?.listName || '',
          selectedGroup: rule?.groupName || '',
        }
      })

      setItems(items)

      // Auto-apply rules on the server for matched transactions
      const toApply = unclassified.filter(tx => matchesTx(tx))
      if (toApply.length > 0) {
        // Group by rule and bulk-update
        const grouped = new Map<string, { ids: string[]; listName: string | null; groupName: string | null }>()
        toApply.forEach(tx => {
          const rule = matchesTx(tx)!
          const key = `${rule.listName}|${rule.groupName}`
          if (!grouped.has(key)) grouped.set(key, { ids: [], listName: rule.listName, groupName: rule.groupName })
          grouped.get(key)!.ids.push(tx.id)
        })
        grouped.forEach(({ ids, listName, groupName }) => {
          fetch('/api/transactions/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, listName, groupName, isRecurring: false, recurringType: 'one_time' }),
          })
        })
      }

      const hasPending = items.some(it => it.status === 'pending')
      if (!hasPending) setFinished(true)
    })
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

  const handleAddList = async () => {
    if (!newListName.trim()) return
    await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListName.trim() }),
    })
    const res = await fetch('/api/lists')
    const data = await res.json()
    onListsUpdated(data.lists, data.groups)
    setItems(prev => prev.map((it, i) => i === currentIdx ? { ...it, selectedList: newListName.trim(), selectedGroup: '' } : it))
    setNewListName('')
    setAddingList(false)
  }

  const handleAddGroup = async () => {
    const item = items[currentIdx]
    if (!newGroupName.trim() || !item?.selectedList) return
    const list = lists.find(l => l.name === item.selectedList)
    if (!list) return
    await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: list.id, listName: list.name, name: newGroupName.trim() }),
    })
    const res = await fetch('/api/lists')
    const data = await res.json()
    onListsUpdated(data.lists, data.groups)
    setItems(prev => prev.map((it, i) => i === currentIdx ? { ...it, selectedGroup: newGroupName.trim() } : it))
    setNewGroupName('')
    setAddingGroup(false)
  }

  const handleSave = async () => {
    const item = items[currentIdx]
    if (!item) return
    setSaving(true)

    const payload = {
      listName: item.selectedList || null,
      groupName: item.selectedGroup || null,
      isRecurring: item.tx.isRecurring,
      recurringType: item.tx.recurringType,
    }

    // Always save the current transaction
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.tx.id, ...payload }),
    })

    if (applyScope !== 'single') {
      const matchValue = item.tx.merchant || item.tx.counterparty || item.tx.description
      const matchType = item.tx.merchant
        ? 'merchant_exact'
        : item.tx.counterparty
        ? 'counterparty_exact'
        : 'description_contains'

      // Apply to all existing matching transactions
      const res = await fetch(`/api/transactions?search=${encodeURIComponent(matchValue)}&pageSize=9999`)
      const data = await res.json()
      const needle = matchValue.toLowerCase()
      const ids = (data.data as Transaction[])
        .filter(t => {
          if (t.id === item.tx.id) return false
          if (matchType === 'merchant_exact') return (t.merchant ?? '').toLowerCase() === needle
          if (matchType === 'counterparty_exact') return (t.counterparty ?? '').toLowerCase() === needle
          return (t.description ?? '').toLowerCase().includes(needle)
        })
        .map(t => t.id)

      if (ids.length > 0) {
        await fetch('/api/transactions/bulk', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, ...payload }),
        })
      }

      // Create rule for future imports
      if (applyScope === 'all_existing_and_future') {
        await fetch('/api/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchType,
            matchValue,
            listName: payload.listName,
            groupName: payload.groupName,
            isRecurring: item.tx.isRecurring,
            recurringType: item.tx.recurringType,
            recurringEndType: null,
            recurringEndDate: null,
            applyToFutureImports: true,
            priority: 0,
          }),
        })
      }
    }

    // Auto-skip remaining items that match the same rule
    if (applyScope !== 'single') {
      const matchValue = item.tx.merchant || item.tx.counterparty || item.tx.description
      const matchType = item.tx.merchant
        ? 'merchant_exact'
        : item.tx.counterparty
        ? 'counterparty_exact'
        : 'description_contains'
      const needle = matchValue.toLowerCase()

      setItems(prev => prev.map((it, i) => {
        if (i <= currentIdx) return it
        if (it.status !== 'pending') return it
        const matches =
          matchType === 'merchant_exact' ? (it.tx.merchant ?? '').toLowerCase() === needle :
          matchType === 'counterparty_exact' ? (it.tx.counterparty ?? '').toLowerCase() === needle :
          (it.tx.description ?? '').toLowerCase().includes(needle)
        return matches ? { ...it, status: 'skipped' } : it
      }))
    }

    // Reset scope for next item and advance
    setApplyScope('single')
    setSaving(false)
    goNext()
  }

  const handleSkip = () => {
    setItems(prev => prev.map((it, i) => i === currentIdx ? { ...it, status: 'skipped' } : it))
    goNext()
  }

  const goNext = () => {
    setItems(prev => {
      const nextPendingIdx = prev.findIndex((it, i) => i > currentIdx && it.status === 'pending')
      if (nextPendingIdx === -1) {
        setFinished(true)
      } else {
        setCurrentIdx(nextPendingIdx)
      }
      return prev
    })
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
          <p className="text-slate-500 text-sm mb-5">
            {items.length > 0
              ? `${items.length} ongeklasseerde transacties verwerkt.`
              : 'Alle geselecteerde transacties waren al geklasseerd.'}
          </p>
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
            <div className="space-y-1.5">
              <select
                value={item.selectedList}
                onChange={e => setItems(prev => prev.map((it, i) => i === currentIdx
                  ? { ...it, selectedList: e.target.value, selectedGroup: '' } : it))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">— Geen categorie —</option>
                {lists.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
              {addingList ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                    placeholder="Naam nieuwe lijst..."
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                    onKeyDown={e => e.key === 'Enter' && handleAddList()}
                    autoFocus
                  />
                  <button onClick={handleAddList} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Toevoegen</button>
                  <button onClick={() => setAddingList(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-500">Annuleren</button>
                </div>
              ) : (
                <button onClick={() => setAddingList(true)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
                  <Plus size={13} /> Nieuwe lijst aanmaken
                </button>
              )}
            </div>
          </div>

          {/* Group selector */}
          {item.selectedList && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Groep</label>
              <div className="space-y-1.5">
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
                {addingGroup ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      placeholder="Naam nieuwe groep..."
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                      autoFocus
                    />
                    <button onClick={handleAddGroup} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Toevoegen</button>
                    <button onClick={() => setAddingGroup(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-500">Annuleren</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingGroup(true)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
                    <Plus size={13} /> Nieuwe groep aanmaken
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Apply scope */}
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
            <p className="text-xs font-medium text-amber-800 mb-2">
              Toepassen op transacties van <span className="italic">{item.tx.merchant || item.tx.counterparty || item.tx.description}</span>:
            </p>
            <div className="space-y-1.5">
              {([
                { value: 'single', label: 'Alleen deze transactie' },
                { value: 'all_existing', label: 'Alle bestaande transacties' },
                { value: 'all_existing_and_future', label: 'Bestaande + toekomstige imports (regel aanmaken)' },
              ] as { value: ApplyScope; label: string }[]).map(opt => (
                <label key={opt.value} className="flex items-center gap-2 text-xs text-amber-700 cursor-pointer">
                  <input
                    type="radio"
                    name="applyScope"
                    value={opt.value}
                    checked={applyScope === opt.value}
                    onChange={() => setApplyScope(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

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
