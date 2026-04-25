'use client'

import { useEffect, useState } from 'react'
import { Transaction, TransactionList, TransactionGroup } from '@/types'
import Modal from '@/components/ui/Modal'
import { Plus, Sparkles } from 'lucide-react'

interface ClassificationModalProps {
  transaction?: Transaction
  bulkIds?: string[]
  sampleTransaction?: Transaction
  lists: TransactionList[]
  groups: TransactionGroup[]
  onClose: () => void
  onSaved: () => void
  onListsUpdated: (lists: TransactionList[], groups: TransactionGroup[]) => void
}

type ApplyScope = 'single' | 'all_existing' | 'all_existing_and_future'

export default function ClassificationModal({
  transaction,
  bulkIds,
  sampleTransaction,
  lists,
  groups,
  onClose,
  onSaved,
  onListsUpdated,
}: ClassificationModalProps) {
  const isBulk = !!bulkIds && bulkIds.length > 0
  const title = isBulk ? `${bulkIds!.length} transacties categoriseren` : 'Transactie categoriseren'

  const [selectedList, setSelectedList] = useState(transaction?.listName || '')
  const [selectedGroup, setSelectedGroup] = useState(transaction?.groupName || '')
  const [isRecurring, setIsRecurring] = useState(transaction?.isRecurring || false)
  const [recurringEndType, setRecurringEndType] = useState(transaction?.recurringEndType || 'ongoing')
  const [recurringEndDate, setRecurringEndDate] = useState(transaction?.recurringEndDate || '')
  const [applyScope, setApplyScope] = useState<ApplyScope>('single')
  const [showScopeQuestion, setShowScopeQuestion] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [addingList, setAddingList] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)

  const filteredGroups = groups.filter(g => g.listName === selectedList)

  // Show scope question when list/group changes (not for bulk)
  useEffect(() => {
    if (!isBulk && transaction && (selectedList !== transaction.listName || selectedGroup !== transaction.groupName)) {
      if (transaction.counterparty || transaction.merchant || transaction.description) {
        setShowScopeQuestion(true)
      }
    }
  }, [selectedList, selectedGroup, isBulk, transaction])

  const handleAISuggest = async () => {
    const tx = transaction || sampleTransaction
    if (!tx) return
    setSuggesting(true)
    try {
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
        const { listName, groupName } = await res.json()
        if (listName) setSelectedList(listName)
        if (groupName) setSelectedGroup(groupName)
        else setSelectedGroup('')
      }
    } finally {
      setSuggesting(false)
    }
  }

  const handleAddList = async () => {
    if (!newListName.trim()) return
    const res = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListName.trim() }),
    })
    const newList = await res.json()
    const listsRes = await fetch('/api/lists')
    const data = await listsRes.json()
    onListsUpdated(data.lists, data.groups)
    setSelectedList(newList.name)
    setNewListName('')
    setAddingList(false)
  }

  const handleAddGroup = async () => {
    if (!newGroupName.trim() || !selectedList) return
    const list = lists.find(l => l.name === selectedList)
    if (!list) return
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: list.id, listName: list.name, name: newGroupName.trim() }),
    })
    const newGroup = await res.json()
    const listsRes = await fetch('/api/lists')
    const data = await listsRes.json()
    onListsUpdated(data.lists, data.groups)
    setSelectedGroup(newGroup.name)
    setNewGroupName('')
    setAddingGroup(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        listName: selectedList || null,
        groupName: selectedGroup || null,
        isRecurring,
        recurringType: isRecurring ? 'recurring' : 'one_time',
        recurringEndType: isRecurring ? recurringEndType : null,
        recurringEndDate: isRecurring && recurringEndType === 'ends_on_date' ? recurringEndDate : null,
      }

      if (isBulk) {
        const res = await fetch('/api/transactions/bulk', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: bulkIds, ...payload }),
        })
        if (!res.ok) throw new Error('Bulk update mislukt')
      } else if (transaction) {
        // Update single transaction
        const res = await fetch('/api/transactions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: transaction.id, ...payload }),
        })
        if (!res.ok) throw new Error('Update mislukt')

        // Apply to other transactions based on scope
        if (applyScope !== 'single' && (transaction.counterparty || transaction.merchant || transaction.description)) {
          const matchValue = transaction.counterparty || transaction.merchant || transaction.description
          const matchType = transaction.counterparty ? 'counterparty_exact' : transaction.merchant ? 'merchant_exact' : 'description_contains'

          // Apply to all existing
          if (applyScope === 'all_existing' || applyScope === 'all_existing_and_future') {
            // Haal alle transacties op via search, filter daarna exact client-side
            const res = await fetch(`/api/transactions?search=${encodeURIComponent(matchValue)}&pageSize=9999`)
            const data = await res.json()
            const needle = matchValue.toLowerCase()
            const ids = (data.data as Transaction[])
              .filter(t => {
                if (t.id === transaction.id) return false
                if (matchType === 'counterparty_exact') return (t.counterparty ?? '').toLowerCase() === needle
                if (matchType === 'merchant_exact') return (t.merchant ?? '').toLowerCase() === needle
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
          }

          // Create rule for future imports
          if (applyScope === 'all_existing_and_future') {
            await fetch('/api/rules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                matchType,
                matchValue,
                listName: selectedList || null,
                groupName: selectedGroup || null,
                isRecurring,
                recurringType: isRecurring ? 'recurring' : 'one_time',
                recurringEndType: isRecurring ? recurringEndType : null,
                recurringEndDate: isRecurring && recurringEndType === 'ends_on_date' ? recurringEndDate : null,
                applyToFutureImports: true,
                priority: 0,
              }),
            })
          }
        }
      }

      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        {/* Transaction info */}
        {transaction && (
          <div className="bg-slate-50 rounded-xl p-3 text-sm">
            <div className="font-medium text-slate-800">
              {transaction.merchant || transaction.counterparty || transaction.description}
            </div>
            <div className="text-slate-500 mt-0.5">{transaction.transactionDate} · {transaction.amount > 0 ? '+' : ''}{transaction.amount.toFixed(2)} {transaction.currency}</div>
          </div>
        )}

        {/* AI suggestion */}
        {(transaction || sampleTransaction) && (
          <button
            onClick={handleAISuggest}
            disabled={suggesting}
            className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {suggesting ? 'AI denkt na...' : 'AI-suggestie'}
          </button>
        )}

        {/* List selector */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Lijst</label>
          <div className="space-y-1.5">
            <select
              value={selectedList}
              onChange={e => { setSelectedList(e.target.value); setSelectedGroup('') }}
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
                <button onClick={handleAddList} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  Toevoegen
                </button>
                <button onClick={() => setAddingList(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-500">
                  Annuleren
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingList(true)}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
              >
                <Plus size={13} /> Nieuwe lijst aanmaken
              </button>
            )}
          </div>
        </div>

        {/* Group selector */}
        {selectedList && (
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Groep</label>
            <div className="space-y-1.5">
              <select
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">— Geen groep —</option>
                {filteredGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
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
                  <button onClick={handleAddGroup} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    Toevoegen
                  </button>
                  <button onClick={() => setAddingGroup(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-500">
                    Annuleren
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingGroup(true)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
                >
                  <Plus size={13} /> Nieuwe groep aanmaken
                </button>
              )}
            </div>
          </div>
        )}

        {/* Recurring */}
        <div className="border-t border-slate-100 pt-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={e => setIsRecurring(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="font-medium">Terugkerende transactie</span>
          </label>

          {isRecurring && (
            <div className="mt-3 pl-6 space-y-2">
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="recurringEnd"
                    value="ongoing"
                    checked={recurringEndType === 'ongoing'}
                    onChange={() => setRecurringEndType('ongoing')}
                  />
                  Doorlopend
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="recurringEnd"
                    value="ends_on_date"
                    checked={recurringEndType === 'ends_on_date'}
                    onChange={() => setRecurringEndType('ends_on_date')}
                  />
                  Eindigt op datum
                </label>
              </div>
              {recurringEndType === 'ends_on_date' && (
                <input
                  type="date"
                  value={recurringEndDate}
                  onChange={e => setRecurringEndDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                />
              )}
            </div>
          )}
        </div>

        {/* Apply scope question */}
        {showScopeQuestion && !isBulk && (
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
            <p className="text-sm font-medium text-amber-800 mb-2">
              Wil je dit toepassen op alle transacties van{' '}
              <span className="italic">{transaction?.merchant || transaction?.counterparty || transaction?.description}</span>?
            </p>
            <div className="space-y-1.5">
              {[
                { value: 'single' as ApplyScope, label: 'Alleen deze transactie' },
                { value: 'all_existing' as ApplyScope, label: 'Alle bestaande transacties' },
                { value: 'all_existing_and_future' as ApplyScope, label: 'Bestaande + toekomstige imports (regel aanmaken)' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer">
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
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-60"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
