'use client'

import { useEffect, useRef, useState } from 'react'
import { formatEuro, formatMonth } from '@/lib/utils'
import { TrendingUp, TrendingDown, ArrowLeftRight, Calendar, Pencil, Check, X } from 'lucide-react'
import clsx from 'clsx'

interface RecurringSeries {
  seriesKey: string
  name: string
  listName: string | null
  groupName: string | null
  direction: 'income' | 'expense'
  amount: number
  frequency: string
  frequencyLabel: string
  monthlyEquivalent: number
  expectedNextMonth: boolean
  lastDate: string
  occurrences: number
}

interface CategoryAvg {
  listName: string
  avgMonthly: number
}

interface ForecastData {
  nextMonth: string
  avgMonths: string[]
  recurring: RecurringSeries[]
  expectedRecurringExpenses: number
  expectedRecurringIncome: number
  avgExpensesByCategory: CategoryAvg[]
  avgIncomeByCategory: CategoryAvg[]
  forecastExpenses: number
  forecastIncome: number
  forecastCashflow: number
}

type Scope = 'all' | 'personal' | 'shared'
const SCOPE_OPTIONS = [
  { value: 'all' as Scope, label: 'Alle rekeningen', mobileLabel: 'Alle' },
  { value: 'personal' as Scope, label: 'Mijn rekeningen', mobileLabel: 'Mijn' },
  { value: 'shared' as Scope, label: 'Gemeenschappelijk', mobileLabel: 'Gedeeld' },
]

const FREQ_ORDER = ['weekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual']
const FREQ_LABELS: Record<string, string> = {
  weekly:     'Wekelijks',
  monthly:    'Maandelijks',
  bimonthly:  'Tweemaandelijks',
  quarterly:  'Driemaandelijks',
  semiannual: 'Halfjaarlijks',
  annual:     'Jaarlijks',
}
const FREQ_COLORS: Record<string, string> = {
  weekly:     'bg-purple-100 text-purple-700 border-purple-200',
  monthly:    'bg-blue-100 text-blue-700 border-blue-200',
  bimonthly:  'bg-cyan-100 text-cyan-700 border-cyan-200',
  quarterly:  'bg-amber-100 text-amber-700 border-amber-200',
  semiannual: 'bg-orange-100 text-orange-700 border-orange-200',
  annual:     'bg-red-100 text-red-700 border-red-200',
}

function LabelEditor({ series, onSaved }: {
  series: RecurringSeries
  onSaved: (seriesKey: string, newName: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(series.name !== series.seriesKey ? series.name : '')
  const inputRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    const label = value.trim() || null
    await fetch('/api/forecast', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesKey: series.seriesKey, label }),
    })
    onSaved(series.seriesKey, label)
    setEditing(false)
  }

  const cancel = () => {
    setValue(series.name !== series.seriesKey ? series.name : '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={series.seriesKey}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="text-sm border border-blue-300 rounded-lg px-2 py-1 w-40 focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus
        />
        <button onClick={save} className="p-1 text-green-600 hover:text-green-700">
          <Check size={14} />
        </button>
        <button onClick={cancel} className="p-1 text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-500 transition-colors mt-0.5"
      title="Naam aanpassen"
    >
      <Pencil size={11} />
      <span>Naam aanpassen</span>
    </button>
  )
}

function FreqSection({ freq, series, nextMonth, onLabelSaved }: {
  freq: string
  series: RecurringSeries[]
  nextMonth: string
  onLabelSaved: (seriesKey: string, newName: string | null) => void
}) {
  const expenses = series.filter(r => r.direction === 'expense')
  const income = series.filter(r => r.direction === 'income')
  const total = series.reduce((s, r) => {
    const sign = r.direction === 'income' ? 1 : -1
    return s + sign * r.amount
  }, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-xs font-semibold px-2.5 py-1 rounded-full border',
            FREQ_COLORS[freq] || 'bg-slate-100 text-slate-600 border-slate-200'
          )}>
            {FREQ_LABELS[freq] || freq}
          </span>
          <span className="text-xs text-slate-400">{series.length} {series.length === 1 ? 'reeks' : 'reeksen'}</span>
        </div>
        <span className={clsx('text-sm font-semibold', total >= 0 ? 'text-green-600' : 'text-red-500')}>
          {total >= 0 ? '+' : ''}{formatEuro(total)}
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {income.map(r => (
          <SeriesRow key={r.seriesKey} r={r} nextMonth={nextMonth} onLabelSaved={onLabelSaved} />
        ))}
        {expenses.map(r => (
          <SeriesRow key={r.seriesKey} r={r} nextMonth={nextMonth} onLabelSaved={onLabelSaved} />
        ))}
      </div>
    </div>
  )
}

function SeriesRow({ r, nextMonth, onLabelSaved }: {
  r: RecurringSeries
  nextMonth: string
  onLabelSaved: (seriesKey: string, newName: string | null) => void
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-800">{r.name}</span>
            {r.expectedNextMonth && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                verwacht {formatMonth(nextMonth)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {r.listName && <span className="text-xs text-slate-400">{r.listName}{r.groupName ? ` · ${r.groupName}` : ''}</span>}
            {r.occurrences > 1 && <span className="text-xs text-slate-400">{r.occurrences}×</span>}
          </div>
          <LabelEditor series={r} onSaved={onLabelSaved} />
        </div>
        <div className="text-right shrink-0">
          <div className={clsx('text-sm font-semibold', r.direction === 'income' ? 'text-green-600' : 'text-red-500')}>
            {r.direction === 'income' ? '+' : ''}{formatEuro(r.amount)}
          </div>
          <div className="text-xs text-slate-400">≈ {formatEuro(r.monthlyEquivalent)}/mnd</div>
        </div>
      </div>
    </div>
  )
}

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<Scope>('all')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/forecast?scope=${scope}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [scope])

  const handleLabelSaved = (seriesKey: string, newName: string | null) => {
    if (!data) return
    setData({
      ...data,
      recurring: data.recurring.map(r =>
        r.seriesKey === seriesKey ? { ...r, name: newName || r.seriesKey } : r
      ),
    })
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 h-32 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data) return <div className="p-6 text-red-500">Kon prognose niet laden.</div>

  const expectedExpenses = data.recurring.filter(r => r.direction === 'expense' && r.expectedNextMonth)
  const expectedIncome = data.recurring.filter(r => r.direction === 'income' && r.expectedNextMonth)
  const maxExpCat = data.avgExpensesByCategory[0]?.avgMonthly || 1
  const maxIncCat = data.avgIncomeByCategory[0]?.avgMonthly || 1

  // Group all recurring by frequency
  const byFreq: Record<string, RecurringSeries[]> = {}
  for (const r of data.recurring) {
    if (!byFreq[r.frequency]) byFreq[r.frequency] = []
    byFreq[r.frequency].push(r)
  }
  const freqGroups = FREQ_ORDER.filter(f => byFreq[f]?.length)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Prognose</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Verwachte kosten voor {formatMonth(data.nextMonth)} · gemiddelde van {data.avgMonths.map(m => formatMonth(m)).join(', ')}
        </p>
      </div>

      {/* Scope filter */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {SCOPE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setScope(opt.value)}
            className={clsx(
              'flex-1 py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-colors',
              scope === opt.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <span className="sm:hidden">{opt.mobileLabel}</span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Verwachte inkomsten</span>
            <span className="p-1.5 rounded-lg bg-green-50"><TrendingUp size={14} className="text-green-600" /></span>
          </div>
          <div className="text-lg md:text-xl font-bold text-slate-900">{formatEuro(data.forecastIncome)}</div>
          <div className="text-xs text-slate-400 mt-1">gemiddelde</div>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Verwachte uitgaven</span>
            <span className="p-1.5 rounded-lg bg-red-50"><TrendingDown size={14} className="text-red-500" /></span>
          </div>
          <div className="text-lg md:text-xl font-bold text-slate-900">{formatEuro(data.forecastExpenses)}</div>
          <div className="text-xs text-slate-400 mt-1">gemiddelde</div>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Verwachte cashflow</span>
            <span className={clsx('p-1.5 rounded-lg', data.forecastCashflow >= 0 ? 'bg-blue-50' : 'bg-orange-50')}>
              <ArrowLeftRight size={14} className={data.forecastCashflow >= 0 ? 'text-blue-600' : 'text-orange-500'} />
            </span>
          </div>
          <div className={clsx('text-lg md:text-xl font-bold', data.forecastCashflow >= 0 ? 'text-green-700' : 'text-red-600')}>
            {formatEuro(data.forecastCashflow)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{data.forecastCashflow >= 0 ? 'positief' : 'negatief'}</div>
        </div>
      </div>

      {/* Expected next month */}
      {(expectedExpenses.length > 0 || expectedIncome.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-blue-500" />
              <h2 className="font-semibold text-slate-800">Verwacht in {formatMonth(data.nextMonth)}</h2>
            </div>
            <div className="text-right">
              {data.expectedRecurringIncome > 0 && (
                <div className="text-sm font-semibold text-green-600">+{formatEuro(data.expectedRecurringIncome)}</div>
              )}
              <div className="text-sm font-semibold text-red-500">{formatEuro(data.expectedRecurringExpenses)}</div>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {expectedIncome.map(r => (
              <div key={r.seriesKey} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                  <div className="text-xs text-slate-400">{r.listName || 'Geen categorie'} · {r.frequencyLabel}</div>
                </div>
                <span className="text-sm font-semibold text-green-600 whitespace-nowrap">+{formatEuro(r.amount)}</span>
              </div>
            ))}
            {expectedExpenses.map(r => (
              <div key={r.seriesKey} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                  <div className="text-xs text-slate-400">{r.listName || 'Geen categorie'} · {r.frequencyLabel}</div>
                </div>
                <span className="text-sm font-semibold text-red-500 whitespace-nowrap">{formatEuro(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recurring grouped by frequency */}
      {freqGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-800">Terugkerende transacties</h2>
          {freqGroups.map(freq => (
            <FreqSection
              key={freq}
              freq={freq}
              series={byFreq[freq]}
              nextMonth={data.nextMonth}
              onLabelSaved={handleLabelSaved}
            />
          ))}
        </div>
      )}

      {data.recurring.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 text-sm">
          Geen terugkerende transacties gevonden. Markeer transacties als terugkerend via de transactielijst.
        </div>
      )}

      {/* Category averages */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Gem. uitgaven per categorie</h2>
            <p className="text-xs text-slate-400">Laatste 3 maanden</p>
          </div>
          <div className="p-4 space-y-3">
            {data.avgExpensesByCategory.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">Geen gegevens</p>
            )}
            {data.avgExpensesByCategory.map(cat => (
              <div key={cat.listName}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700 truncate mr-2">{cat.listName}</span>
                  <span className="text-slate-600 shrink-0 font-medium">{formatEuro(cat.avgMonthly)}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.round((cat.avgMonthly / maxExpCat) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Gem. inkomsten per categorie</h2>
            <p className="text-xs text-slate-400">Laatste 3 maanden</p>
          </div>
          <div className="p-4 space-y-3">
            {data.avgIncomeByCategory.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">Geen gegevens</p>
            )}
            {data.avgIncomeByCategory.map(cat => (
              <div key={cat.listName}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700 truncate mr-2">{cat.listName}</span>
                  <span className="text-slate-600 shrink-0 font-medium">{formatEuro(cat.avgMonthly)}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round((cat.avgMonthly / maxIncCat) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
