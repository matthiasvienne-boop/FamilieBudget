'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { Transaction, TransactionList, TransactionGroup } from '@/types'
import { formatEuro, formatDate, getCurrentMonth } from '@/lib/utils'
import { getLast12Months, formatMonth } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ClassificationModal from '@/components/transactions/ClassificationModal'
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Trash2,
  Tag,
  Check,
  RepeatIcon,
  X,
  ChevronDown,
} from 'lucide-react'
import clsx from 'clsx'

type FiltersState = {
  month: string
  source: string
  listName: string
  direction: string
  uncategorized: boolean
  search: string
}

function TransactionsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState<FiltersState>({
    month: '',
    source: '',
    listName: searchParams.get('listName') || '',
    direction: '',
    uncategorized: searchParams.get('uncategorized') === 'true',
    search: '',
  })

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lists, setLists] = useState<TransactionList[]>([])
  const [groups, setGroups] = useState<TransactionGroup[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [classifyTx, setClassifyTx] = useState<Transaction | null>(null)
  const [classifyBulk, setClassifyBulk] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const months = getLast12Months()

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.month) params.set('month', filters.month)
    if (filters.source) params.set('source', filters.source)
    if (filters.listName === '__none__') params.set('listName', '__none__')
    else if (filters.listName) params.set('listName', filters.listName)
    if (filters.direction) params.set('direction', filters.direction)
    if (filters.uncategorized) params.set('uncategorized', 'true')
    if (filters.search) params.set('search', filters.search)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))

    const res = await fetch(`/api/transactions?${params}`)
    const data = await res.json()
    setTransactions(data.data || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [filters, page, pageSize])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    fetch('/api/lists')
      .then(r => r.json())
      .then(d => {
        setLists(d.lists || [])
        setGroups(d.groups || [])
      })
  }, [])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(transactions.map(t => t.id)))
    }
  }

  const handleBulkDelete = async () => {
    try {
      const res = await fetch('/api/transactions/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      if (!res.ok) throw new Error('Delete failed')
    } catch (e) {
      console.error(e)
      alert('Verwijderen mislukt. Probeer opnieuw.')
      return
    }
    setSelected(new Set())
    setConfirmDelete(false)
    setPage(1)
    fetchTransactions()
  }

  const handleClassified = () => {
    setClassifyTx(null)
    setClassifyBulk(false)
    setSelected(new Set())
    fetchTransactions()
  }

  const directionLabel: Record<string, string> = {
    income: 'Inkomst',
    expense: 'Uitgave',
    transfer: 'Transfer',
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Transacties</h1>
          <p className="text-sm text-slate-500">{total} resultaten</p>
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
            showFilters
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          <Filter size={16} />
          Filters
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Month */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Maand</label>
              <select
                value={filters.month}
                onChange={e => { setFilters(f => ({ ...f, month: e.target.value })); setPage(1) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">Alle maanden</option>
                {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
              </select>
            </div>
            {/* Source */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Bron</label>
              <select
                value={filters.source}
                onChange={e => { setFilters(f => ({ ...f, source: e.target.value })); setPage(1) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">Alle</option>
                <option value="revolut">Revolut</option>
                <option value="crelan">Crelan</option>
              </select>
            </div>
            {/* Category */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Categorie</label>
              <select
                value={filters.listName}
                onChange={e => { setFilters(f => ({ ...f, listName: e.target.value, uncategorized: false })); setPage(1) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">Alle</option>
                <option value="__none__">Ongecategoriseerd</option>
                {lists.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
            </div>
            {/* Direction */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Type</label>
              <select
                value={filters.direction}
                onChange={e => { setFilters(f => ({ ...f, direction: e.target.value })); setPage(1) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">Alle</option>
                <option value="income">Inkomsten</option>
                <option value="expense">Uitgaven</option>
                <option value="transfer">Transfers</option>
              </select>
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Zoek op omschrijving, tegenpartij..."
              value={filters.search}
              onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
            />
          </div>
          {/* Uncategorized toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.uncategorized}
              onChange={e => { setFilters(f => ({ ...f, uncategorized: e.target.checked, listName: '' })); setPage(1) }}
              className="rounded border-slate-300"
            />
            Alleen ongecategoriseerd
          </label>
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-4">
          <span className="text-sm font-medium text-blue-700">{selected.size} geselecteerd</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setClassifyBulk(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              <Tag size={14} />
              Categoriseren
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 text-red-600"
            >
              <Trash2 size={14} />
              Verwijderen
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="p-1.5 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selected.size === transactions.length && transactions.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Datum</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Omschrijving</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Categorie</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Bron</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Bedrag</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Laden...</td>
              </tr>
            )}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Geen transacties gevonden</td>
              </tr>
            )}
            {transactions.map(tx => (
              <tr
                key={tx.id}
                className={clsx(
                  'hover:bg-slate-50 transition-colors',
                  selected.has(tx.id) && 'bg-blue-50'
                )}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(tx.id)}
                    onChange={() => toggleSelect(tx.id)}
                    className="rounded border-slate-300"
                  />
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(tx.transactionDate)}</td>
                <td className="px-4 py-3 max-w-xs">
                  <div className="truncate text-slate-800 font-medium">
                    {tx.merchant || tx.counterparty || tx.description}
                  </div>
                  {tx.merchant && (tx.counterparty || tx.description) && (
                    <div className="text-xs text-slate-400 truncate">{tx.description}</div>
                  )}
                  {tx.isRecurring && (
                    <Badge variant="recurring" className="mt-0.5">
                      <RepeatIcon size={10} className="mr-1" />Recurring
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {tx.listName ? (
                    <div>
                      <div className="text-xs font-medium text-slate-700">{tx.listName}</div>
                      {tx.groupName && <div className="text-xs text-slate-400">{tx.groupName}</div>}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 italic">Ongecategoriseerd</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={tx.source === 'revolut' ? 'default' : 'default'}>
                    {tx.source}
                  </Badge>
                </td>
                <td className={clsx(
                  'px-4 py-3 text-right font-semibold whitespace-nowrap',
                  tx.direction === 'income' ? 'text-green-600' : tx.direction === 'expense' ? 'text-red-500' : 'text-slate-400'
                )}>
                  {tx.direction === 'income' ? '+' : ''}{formatEuro(tx.amount)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setClassifyTx(tx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                    title="Categoriseren"
                  >
                    <Tag size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="md:hidden space-y-2">
        {loading && <div className="text-center text-slate-400 py-8">Laden...</div>}
        {!loading && transactions.length === 0 && (
          <div className="text-center text-slate-400 py-8">Geen transacties gevonden</div>
        )}
        {transactions.map(tx => (
          <div
            key={tx.id}
            className={clsx(
              'bg-white rounded-xl border px-4 py-3 transition-colors',
              selected.has(tx.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-100'
            )}
            onClick={() => toggleSelect(tx.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 mr-3">
                <div className="font-medium text-slate-800 truncate">
                  {tx.merchant || tx.counterparty || tx.description}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{formatDate(tx.transactionDate)}</div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <Badge variant="default">{tx.source}</Badge>
                  {tx.listName ? (
                    <Badge variant="default">{tx.listName}</Badge>
                  ) : (
                    <span className="text-xs text-slate-300 italic">Ongecategoriseerd</span>
                  )}
                  {tx.isRecurring && <Badge variant="recurring"><RepeatIcon size={9} className="mr-0.5" />Recurring</Badge>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={clsx(
                  'font-bold text-base',
                  tx.direction === 'income' ? 'text-green-600' : tx.direction === 'expense' ? 'text-red-500' : 'text-slate-400'
                )}>
                  {tx.direction === 'income' ? '+' : ''}{formatEuro(tx.amount)}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); setClassifyTx(tx) }}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                >
                  <Tag size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            {total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} van {total}
          </span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600"
          >
            <option value={25}>25 / pagina</option>
            <option value={50}>50 / pagina</option>
            <option value={100}>100 / pagina</option>
            <option value={250}>250 / pagina</option>
          </select>
        </div>
        {total > pageSize && (
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-600">{page} / {Math.ceil(total / pageSize)}</span>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Classification modal for single tx */}
      {classifyTx && (
        <ClassificationModal
          transaction={classifyTx}
          lists={lists}
          groups={groups}
          onClose={() => setClassifyTx(null)}
          onSaved={handleClassified}
          onListsUpdated={(l, g) => { setLists(l); setGroups(g) }}
        />
      )}

      {/* Classification modal for bulk */}
      {classifyBulk && (
        <ClassificationModal
          bulkIds={Array.from(selected)}
          lists={lists}
          groups={groups}
          onClose={() => setClassifyBulk(false)}
          onSaved={handleClassified}
          onListsUpdated={(l, g) => { setLists(l); setGroups(g) }}
        />
      )}

      {/* Confirm delete modal */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Transacties verwijderen"
        size="sm"
      >
        <p className="text-slate-600 mb-4">
          Wil je {selected.size} transactie{selected.size !== 1 ? 's' : ''} verwijderen?
          Dit is een soft-delete en kan hersteld worden.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmDelete(false)}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
          >
            Annuleren
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
          >
            Verwijderen
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Laden...</div>}>
      <TransactionsPageInner />
    </Suspense>
  )
}
