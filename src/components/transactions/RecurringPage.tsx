'use client'

import { useEffect, useState } from 'react'
import { Transaction } from '@/types'
import { formatEuro, formatDate } from '@/lib/utils'
import { RepeatIcon, Calendar } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import clsx from 'clsx'

export default function RecurringPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/transactions?isRecurring=true&pageSize=200')
      .then(r => r.json())
      .then(d => setTransactions(d.data || []))
      .finally(() => setLoading(false))
  }, [])

  const grouped = transactions.reduce((acc, tx) => {
    const key = tx.listName || 'Ongecategoriseerd'
    if (!acc[key]) acc[key] = []
    acc[key].push(tx)
    return acc
  }, {} as Record<string, Transaction[]>)

  const totalRecurring = transactions
    .filter(t => t.direction === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const totalIncome = transactions
    .filter(t => t.direction === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Terugkerende transacties</h1>
      <p className="text-slate-500 text-sm mb-6">Overzicht van uw vaste inkomsten en uitgaven</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="text-xs text-slate-500 mb-1">Vaste uitgaven</div>
          <div className="text-xl font-bold text-red-500">{formatEuro(totalRecurring)}</div>
          <div className="text-xs text-slate-400 mt-0.5">per maand</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="text-xs text-slate-500 mb-1">Vaste inkomsten</div>
          <div className="text-xl font-bold text-green-600">{formatEuro(totalIncome)}</div>
          <div className="text-xs text-slate-400 mt-0.5">per maand</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 col-span-2 md:col-span-1">
          <div className="text-xs text-slate-500 mb-1">Totaal recurring</div>
          <div className="text-xl font-bold text-slate-800">{transactions.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">transacties</div>
        </div>
      </div>

      {loading && <div className="text-slate-400 text-center py-8">Laden...</div>}

      {!loading && transactions.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
          <RepeatIcon size={32} className="mx-auto text-slate-200 mb-3" />
          <div className="text-slate-500">Geen terugkerende transacties gevonden</div>
          <div className="text-sm text-slate-400 mt-1">Markeer transacties als recurring via de transactielijst</div>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([listName, txs]) => (
          <div key={listName} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 bg-slate-50">
              <h2 className="font-semibold text-slate-700 text-sm">{listName}</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {txs.map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="font-medium text-slate-800 text-sm truncate">
                      {tx.merchant || tx.counterparty || tx.description}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{tx.groupName || tx.source}</span>
                      {tx.recurringEndType === 'ends_on_date' && tx.recurringEndDate && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-500">
                          <Calendar size={10} />
                          tot {formatDate(tx.recurringEndDate)}
                        </span>
                      )}
                      {tx.recurringEndType === 'ongoing' && (
                        <span className="text-xs text-slate-400">doorlopend</span>
                      )}
                    </div>
                  </div>
                  <div className={clsx(
                    'font-semibold text-sm whitespace-nowrap',
                    tx.direction === 'income' ? 'text-green-600' : 'text-red-500'
                  )}>
                    {tx.direction === 'income' ? '+' : ''}{formatEuro(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
