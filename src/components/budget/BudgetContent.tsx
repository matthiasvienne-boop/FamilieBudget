'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatEuro, formatMonth } from '@/lib/utils'
import clsx from 'clsx'
import { BarChart2, Check, X, ChevronUp, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { Transaction, TransactionList } from '@/types'

interface Goal {
  id: string
  listName: string
  groupName: string | null
  month: string | null
  goalAmount: number
  direction: string
  period: 'month' | 'year'
  userId: string | null
}

interface HistoryRow {
  listName: string
  groupName: string
  month: string
  total: number
}

interface CurrentRow {
  listName: string
  groupName: string
  total: number
}

interface CategoryData {
  listName: string
  goal: number | null
  goalId: string | null
  goalPeriod: 'month' | 'year'
  listId: string | null
  actual: number
  history: { month: string; total: number }[]
  avg: number
}

interface GroupRow {
  groupName: string
  total: number
  count: number
}

interface TxRow {
  name: string
  total: number
  count: number
}

interface DrilldownState {
  listName: string
  month: string
  monthTotal: number
  groups: GroupRow[]
  // level 2
  selectedGroup?: string
  txRows?: TxRow[]
  txLoading?: boolean
}

function MonthlyBarChart({
  data,
  onBarClick,
}: {
  data: { month: string; total: number }[]
  onBarClick: (month: string) => void
}) {
  if (!data.length) return <p className="text-xs text-slate-400 py-4 text-center">Geen data</p>

  const max = Math.max(...data.map(d => d.total), 1)
  const months = [...data].sort((a, b) => a.month.localeCompare(b.month))

  return (
    <div className="flex items-end gap-1.5 h-24 pt-2">
      {months.map(d => {
        const pct = (d.total / max) * 100
        const [y, m] = d.month.split('-')
        const label = `${m}/${y.slice(2)}`
        return (
          <button
            key={d.month}
            onClick={() => onBarClick(d.month)}
            className="flex-1 flex flex-col items-center gap-1 min-w-0 group"
            title={`${d.month} — ${formatEuro(d.total)}`}
          >
            <span className="text-xs text-slate-500 truncate hidden sm:block">{formatEuro(d.total)}</span>
            <div className="w-full bg-slate-100 rounded-t-sm relative" style={{ height: '64px' }}>
              <div
                className="absolute bottom-0 w-full bg-blue-500 group-hover:bg-blue-600 rounded-t-sm transition-all"
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 group-hover:text-slate-600 truncate">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

function CategoryRow({
  cat,
  onSaveGoal,
  onDrilldown,
  onDelete,
  isPersonal,
}: {
  cat: CategoryData
  onSaveGoal: (listName: string, amount: number | null, period: 'month' | 'year', isPersonal: boolean) => Promise<void>
  onDrilldown: (listName: string, month: string) => void
  onDelete: (goalId: string, listId: string | null) => void
  isPersonal: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(String(cat.goal ?? ''))
  const [periodVal, setPeriodVal] = useState<'month' | 'year'>(cat.goalPeriod)
  const [saving, setSaving] = useState(false)
  const [showChart, setShowChart] = useState(false)

  const pct = cat.goal ? Math.min(100, Math.round((cat.actual / cat.goal) * 100)) : null
  const over = cat.goal != null && cat.actual > cat.goal

  const handleSave = async () => {
    setSaving(true)
    const amount = parseFloat(inputVal.replace(',', '.'))
    await onSaveGoal(cat.listName, isNaN(amount) ? null : amount, periodVal, isPersonal)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-800 truncate">{cat.listName}</span>
            {cat.avg > 0 && (
              <span className="text-xs text-slate-400 shrink-0">
                gem. {formatEuro(cat.avg)}/m
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={clsx('text-sm font-medium', over ? 'text-red-600' : 'text-slate-700')}>
              {formatEuro(cat.actual)}
              {cat.goal != null && (
                <span className="text-slate-400 font-normal">
                  {' '}/ {formatEuro(cat.goal)}{' '}
                  <span className="text-xs">{cat.goalPeriod === 'year' ? 'p/j' : 'p/m'}</span>
                </span>
              )}
            </span>
            <button
              onClick={() => setShowChart(s => !s)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              title="Grafiek"
            >
              <BarChart2 size={14} />
            </button>
            {cat.goalId && (
              <button
                onClick={() => onDelete(cat.goalId!, cat.listId)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                title="Verwijderen"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {cat.goal != null && (
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                over ? 'bg-red-500' : pct! >= 80 ? 'bg-amber-400' : 'bg-blue-500'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* Goal edit */}
        {editing ? (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-slate-500">Doel (€):</span>
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-sm"
              placeholder={cat.avg > 0 ? `Gem: ${Math.round(cat.avg)}` : '0'}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            />
            <select
              value={periodVal}
              onChange={e => setPeriodVal(e.target.value as 'month' | 'year')}
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white"
            >
              <option value="month">per maand</option>
              <option value="year">per jaar</option>
            </select>
            <button onClick={handleSave} disabled={saving} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Check size={14} />
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setInputVal(String(cat.goal ?? '')); setPeriodVal(cat.goalPeriod); setEditing(true) }}
            className="text-xs text-blue-600 hover:text-blue-700 mt-1"
          >
            {cat.goal != null ? 'Doel aanpassen' : '+ Doel instellen'}
          </button>
        )}
      </div>

      {/* Chart */}
      {showChart && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Maandoverzicht (laatste 12 m.)</span>
            <button onClick={() => setShowChart(false)} className="text-slate-400 hover:text-slate-600">
              <ChevronUp size={14} />
            </button>
          </div>
          <MonthlyBarChart
            data={cat.history}
            onBarClick={month => onDrilldown(cat.listName, month)}
          />
        </div>
      )}
    </div>
  )
}

export default function BudgetContent() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [currentMonth, setCurrentMonth] = useState<CurrentRow[]>([])
  const [currentYear, setCurrentYear] = useState<CurrentRow[]>([])
  const [lists, setLists] = useState<TransactionList[]>([])
  const [loading, setLoading] = useState(true)
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'gezamenlijk' | 'persoonlijk'>('gezamenlijk')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [newPersonalCategory, setNewPersonalCategory] = useState('')

  const load = useCallback(async () => {
    const [goalsRes, listsRes] = await Promise.all([fetch('/api/goals'), fetch('/api/lists')])
    const data = await goalsRes.json()
    const listsData = await listsRes.json()
    setCurrentUserId(data.currentUserId ?? null)
    setGoals(data.goals)
    setHistory(data.history)
    setCurrentMonth(data.currentMonth)
    setCurrentYear(data.currentYear ?? [])
    setLists(listsData.lists ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDrilldown = useCallback(async (listName: string, month: string) => {
    setDrillLoading(true)
    setDrilldown({ listName, month, monthTotal: 0, groups: [] })
    const res = await fetch(`/api/transactions?listName=${encodeURIComponent(listName)}&month=${month}&pageSize=9999&direction=expense`)
    const data = await res.json()
    const txs: Transaction[] = data.data || []

    const map = new Map<string, { total: number; count: number }>()
    for (const tx of txs) {
      const key = tx.groupName || '(geen groep)'
      const existing = map.get(key) ?? { total: 0, count: 0 }
      map.set(key, { total: existing.total + Math.abs(tx.amount), count: existing.count + 1 })
    }

    const groups = Array.from(map.entries())
      .map(([groupName, v]) => ({ groupName, ...v }))
      .sort((a, b) => b.total - a.total)

    const monthTotal = groups.reduce((s, r) => s + r.total, 0)
    setDrilldown({ listName, month, groups, monthTotal })
    setDrillLoading(false)
  }, [])

  const handleGroupDrilldown = useCallback(async (groupName: string) => {
    setDrilldown(prev => prev ? { ...prev, selectedGroup: groupName, txRows: [], txLoading: true } : prev)
    const dd = drilldown
    if (!dd) return
    const res = await fetch(
      `/api/transactions?listName=${encodeURIComponent(dd.listName)}&month=${dd.month}&pageSize=9999&direction=expense` +
      (groupName !== '(geen groep)' ? `&groupName=${encodeURIComponent(groupName)}` : '')
    )
    const data = await res.json()
    const txs: Transaction[] = data.data || []

    const map = new Map<string, { total: number; count: number }>()
    for (const tx of txs) {
      const name = tx.merchant || tx.counterparty || tx.description || '(onbekend)'
      const existing = map.get(name) ?? { total: 0, count: 0 }
      map.set(name, { total: existing.total + Math.abs(tx.amount), count: existing.count + 1 })
    }

    const txRows = Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)

    setDrilldown(prev => prev ? { ...prev, txRows, txLoading: false } : prev)
  }, [drilldown])

  const handleSaveGoal = async (listName: string, amount: number | null, period: 'month' | 'year' = 'month', isPersonal = false) => {
    if (amount == null) return
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listName, goalAmount: amount, direction: 'expense', period, isPersonal }),
    })
    await load()
  }

  const handleDeleteGoal = async (goalId: string, listId: string | null) => {
    if (!confirm('Wil je deze budgetcategorie verwijderen?')) return
    const calls: Promise<unknown>[] = [
      fetch(`/api/goals?id=${goalId}`, { method: 'DELETE' }),
    ]
    if (listId) {
      calls.push(fetch(`/api/lists?id=${listId}`, { method: 'DELETE' }))
    }
    await Promise.all(calls)
    await load()
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 animate-pulse" />
        ))}
      </div>
    )
  }

  // Build category data filtered by active tab
  const tabGoals = goals.filter(g =>
    activeTab === 'gezamenlijk' ? g.userId === null : g.userId === currentUserId
  )

  const listsInHistory = [...new Set(history.map(h => h.listName))]
  const listsInCurrent = currentMonth.map(c => c.listName)

  // Voor gezamenlijk: alle lijsten; voor persoonlijk: alleen lijsten met een doel van de user
  const allLists = activeTab === 'gezamenlijk'
    ? [...new Set([...listsInHistory, ...listsInCurrent, ...tabGoals.map(g => g.listName)])]
    : [...new Set(tabGoals.map(g => g.listName))]

  const categories: CategoryData[] = allLists.map(listName => {
    const goal = tabGoals.find(g => g.listName === listName && !g.groupName && !g.month)
    const isYearly = goal?.period === 'year'
    const actualSource = isYearly ? currentYear : currentMonth
    const actual = actualSource
      .filter(c => c.listName === listName)
      .reduce((sum, c) => sum + c.total, 0)
    // Aggregate all groups into list-level monthly totals
    const monthMap = new Map<string, number>()
    history
      .filter(h => h.listName === listName)
      .forEach(h => monthMap.set(h.month, (monthMap.get(h.month) ?? 0) + h.total))
    const listHistory = Array.from(monthMap.entries()).map(([month, total]) => ({ month, total }))
    const avg = listHistory.length > 0
      ? listHistory.reduce((s, h) => s + h.total, 0) / listHistory.length
      : 0

    const personalList = activeTab === 'persoonlijk'
      ? lists.find(l => l.name === listName && l.userId === currentUserId)
      : null

    return {
      listName,
      goal: goal?.goalAmount ?? null,
      goalId: goal?.id ?? null,
      goalPeriod: goal?.period ?? 'month',
      listId: personalList?.id ?? null,
      actual,
      history: listHistory,
      avg,
    }
  }).sort((a, b) => {
    // Sort by actual spend descending
    return b.actual - a.actual
  })

  const totalGoal = categories.reduce((s, c) => s + (c.goal ?? 0), 0)
  const totalActual = categories.reduce((s, c) => s + c.actual, 0)

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('gezamenlijk')}
          className={clsx(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'gezamenlijk' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Gezamenlijk
        </button>
        <button
          onClick={() => setActiveTab('persoonlijk')}
          className={clsx(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'persoonlijk' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Persoonlijk
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Totaal uitgegeven</div>
          <div className="text-xl font-bold text-red-600">{formatEuro(totalActual)}</div>
          <div className="text-xs text-slate-400 mt-0.5">huidige maand</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Totaal budget</div>
          <div className="text-xl font-bold text-slate-800">{totalGoal > 0 ? formatEuro(totalGoal) : '—'}</div>
          <div className="text-xs text-slate-400 mt-0.5">maandelijks doel</div>
        </div>
        {totalGoal > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="text-xs text-slate-500 mb-1">Resterend</div>
            <div className={clsx(
              'text-xl font-bold',
              totalGoal - totalActual >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {formatEuro(totalGoal - totalActual)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {Math.round((totalActual / totalGoal) * 100)}% gebruikt
            </div>
          </div>
        )}
      </div>

      {/* Category list */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Categorieën</h2>
        <div className="space-y-3">
          {categories.length === 0 && activeTab === 'persoonlijk' && (
            <p className="text-slate-400 text-sm text-center py-8">
              Nog geen persoonlijke budgetcategorieën. Voeg er een toe hieronder.
            </p>
          )}
          {categories.map(cat => (
            <CategoryRow
              key={cat.listName}
              cat={cat}
              onSaveGoal={handleSaveGoal}
              onDrilldown={handleDrilldown}
              onDelete={handleDeleteGoal}
              isPersonal={activeTab === 'persoonlijk'}
            />
          ))}
          {categories.length === 0 && activeTab === 'gezamenlijk' && (
            <p className="text-slate-400 text-sm text-center py-8">
              Nog geen gecategoriseerde transacties gevonden.
            </p>
          )}
        </div>
      </div>

      {/* Nieuwe persoonlijke categorie */}
      {activeTab === 'persoonlijk' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Nieuwe persoonlijke categorie</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPersonalCategory}
              onChange={e => setNewPersonalCategory(e.target.value)}
              placeholder="bv. Kleren, Uit eten, Hobby..."
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              onKeyDown={async e => {
                if (e.key === 'Enter' && newPersonalCategory.trim()) {
                  await handleSaveGoal(newPersonalCategory.trim(), 0, 'month', true)
                  setNewPersonalCategory('')
                }
              }}
            />
            <button
              onClick={async () => {
                if (!newPersonalCategory.trim()) return
                await handleSaveGoal(newPersonalCategory.trim(), 0, 'month', true)
                setNewPersonalCategory('')
              }}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Toevoegen
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Maak een persoonlijk budgetcategorie aan. Stel daarna een bedrag in via &quot;+ Doel instellen&quot;.
          </p>
        </div>
      )}

      {/* Drilldown modal */}
      {drilldown && (
        <Modal
          open
          onClose={() => setDrilldown(null)}
          title={
            drilldown.selectedGroup
              ? `${drilldown.listName} / ${drilldown.selectedGroup} — ${formatMonth(drilldown.month)}`
              : `${drilldown.listName} — ${formatMonth(drilldown.month)}`
          }
          size="md"
        >
          {/* Back button when in group detail */}
          {drilldown.selectedGroup && (
            <button
              onClick={() => setDrilldown(prev => prev ? { ...prev, selectedGroup: undefined, txRows: undefined } : prev)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 mb-3"
            >
              ← Terug naar groepen
            </button>
          )}

          {/* Level 1: groups */}
          {!drilldown.selectedGroup && (
            drillLoading ? (
              <div className="space-y-2 py-2">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div>
                <div className="divide-y divide-slate-50">
                  {drilldown.groups.map(row => (
                    <button
                      key={row.groupName}
                      onClick={() => handleGroupDrilldown(row.groupName)}
                      className="w-full flex items-center justify-between py-2.5 gap-3 hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors"
                    >
                      <div className="min-w-0 text-left">
                        <span className="text-sm text-slate-800 truncate block">{row.groupName}</span>
                        <span className="text-xs text-slate-400">{row.count} transactie{row.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-red-600">{formatEuro(row.total)}</span>
                        <ChevronUp size={14} className="text-slate-300 rotate-90" />
                      </div>
                    </button>
                  ))}
                  {drilldown.groups.length === 0 && (
                    <p className="text-sm text-slate-400 py-4 text-center">Geen transacties gevonden</p>
                  )}
                </div>
                {drilldown.groups.length > 0 && (
                  <div className="border-t border-slate-100 pt-3 mt-1 flex justify-between text-sm font-semibold">
                    <span className="text-slate-700">Totaal</span>
                    <span className="text-red-600">{formatEuro(drilldown.monthTotal)}</span>
                  </div>
                )}
              </div>
            )
          )}

          {/* Level 2: transactions within group */}
          {drilldown.selectedGroup && (
            drilldown.txLoading ? (
              <div className="space-y-2 py-2">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div>
                <div className="divide-y divide-slate-50">
                  {(drilldown.txRows || []).map(row => (
                    <div key={row.name} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="min-w-0">
                        <span className="text-sm text-slate-800 truncate block">{row.name}</span>
                        <span className="text-xs text-slate-400">{row.count}×</span>
                      </div>
                      <span className="text-sm font-medium text-red-600 shrink-0">{formatEuro(row.total)}</span>
                    </div>
                  ))}
                  {!drilldown.txRows?.length && (
                    <p className="text-sm text-slate-400 py-4 text-center">Geen transacties gevonden</p>
                  )}
                </div>
                {(drilldown.txRows?.length ?? 0) > 0 && (
                  <div className="border-t border-slate-100 pt-3 mt-1 flex justify-between text-sm font-semibold">
                    <span className="text-slate-700">Totaal</span>
                    <span className="text-red-600">{formatEuro(drilldown.txRows!.reduce((s, r) => s + r.total, 0))}</span>
                  </div>
                )}
              </div>
            )
          )}
        </Modal>
      )}
    </div>
  )
}
