'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatEuro, formatDate } from '@/lib/utils'
import { Trash2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

export default function TrashPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [working, setWorking] = useState(false)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions/trash?page=${p}`)
      const json = await res.json()
      setTransactions(json.data ?? [])
      setTotal(json.total ?? 0)
      setTotalPages(json.totalPages ?? 1)
      setPage(p)
      setSelected(new Set())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleSelect = (id: string) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleAll = () =>
    setSelected(s => s.size === transactions.length ? new Set() : new Set(transactions.map(t => t.id)))

  const restore = async (ids: string[]) => {
    if (ids.length === 0) return
    setWorking(true)
    try {
      await fetch('/api/transactions/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      await load(page)
    } finally { setWorking(false) }
  }

  const hardDelete = async (ids: string[]) => {
    if (ids.length === 0) return
    if (!confirm(`${ids.length} transactie(s) definitief verwijderen? Dit kan niet ongedaan worden.`)) return
    setWorking(true)
    try {
      await fetch('/api/transactions/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      await load(page)
    } finally { setWorking(false) }
  }

  const daysLeft = (updatedAt: string) => {
    const deleted = new Date(updatedAt).getTime()
    const expires = deleted + 30 * 24 * 60 * 60 * 1000
    return Math.max(0, Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000)))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/transactions" className="text-slate-400 hover:text-slate-600">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Prullenbak</h1>
        <span className="text-sm text-slate-400">({total} transacties)</span>
      </div>

      <p className="text-sm text-slate-500 mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        Verwijderde transacties worden <strong>30 dagen bewaard</strong> en daarna automatisch definitief verwijderd.
      </p>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-blue-800">{selected.size} geselecteerd</span>
          <button
            onClick={() => restore(Array.from(selected))}
            disabled={working}
            className="flex items-center gap-1.5 text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCcw size={14} />
            Herstellen
          </button>
          <button
            onClick={() => hardDelete(Array.from(selected))}
            disabled={working}
            className="flex items-center gap-1.5 text-sm bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={14} />
            Definitief verwijderen
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox"
                  checked={selected.size === transactions.length && transactions.length > 0}
                  onChange={toggleAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Datum</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Omschrijving</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Rekening</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Bedrag</th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium">Verwijderd over</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Laden...</td></tr>
            )}
            {!loading && transactions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Prullenbak is leeg</td></tr>
            )}
            {transactions.map(tx => {
              const days = daysLeft(tx.updatedAt)
              return (
                <tr key={tx.id} className={clsx('hover:bg-slate-50', selected.has(tx.id) && 'bg-blue-50')}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)} className="rounded border-slate-300" />
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(tx.transactionDate)}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="truncate text-slate-700">{tx.merchant || tx.counterparty || tx.description}</div>
                    {tx.listName && <div className="text-xs text-slate-400">{tx.listName}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {tx.accountName ? (
                      <span className="text-xs font-medium text-slate-600"
                        style={tx.accountColor ? { color: tx.accountColor } : {}}>
                        {tx.accountName}
                      </span>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>
                  <td className={clsx(
                    'px-4 py-3 text-right font-semibold whitespace-nowrap',
                    tx.direction === 'income' ? 'text-green-600' : tx.direction === 'expense' ? 'text-red-500' : 'text-slate-400'
                  )}>
                    {tx.direction === 'income' ? '+' : ''}{formatEuro(tx.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('text-xs font-medium', days <= 3 ? 'text-red-500' : days <= 7 ? 'text-amber-500' : 'text-slate-400')}>
                      {days}d
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => restore([tx.id])}
                        disabled={working}
                        title="Herstellen"
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        onClick={() => hardDelete([tx.id])}
                        disabled={working}
                        title="Definitief verwijderen"
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>{total} transacties</span>
          <div className="flex items-center gap-2">
            <button onClick={() => load(page - 1)} disabled={page <= 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => load(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
