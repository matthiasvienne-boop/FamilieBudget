'use client'

import { useEffect, useState } from 'react'
import { formatEuro, formatMonth } from '@/lib/utils'
import { TrendingUp, TrendingDown, ArrowLeftRight, ChevronDown, ChevronRight, Calendar, Repeat } from 'lucide-react'
import clsx from 'clsx'

interface RecurringSeries {
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

const FREQ_COLORS: Record<string, string> = {
  weekly:     'bg-purple-100 text-purple-700',
  monthly:    'bg-blue-100 text-blue-700',
  bimonthly:  'bg-cyan-100 text-cyan-700',
  quarterly:  'bg-amber-100 text-amber-700',
  semiannual: 'bg-orange-100 text-orange-700',
  annual:     'bg-red-100 text-red-700',
}

function FreqBadge({ label, freq }: { label: string; freq: string }) {
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', FREQ_COLORS[freq] || 'bg-slate-100 text-slate-600')}>
      {label}
    </span>
  )
}

function SummaryCard({ label, value, sub, colorClass, icon }: {
  label: string
  value: string
  sub?: string
  colorClass: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={clsx('p-1.5 rounded-lg', colorClass)}>{icon}</span>
      </div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<Scope>('all')
  const [showAllRecurring, setShowAllRecurring] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/forecast?scope=${scope}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [scope])

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

  const expectedExpenses = data.recurring
    .filter(r => r.direction === 'expense' && r.expectedNextMonth)
  const expectedIncome = data.recurring
    .filter(r => r.direction === 'income' && r.expectedNextMonth)
  const allExpenses = data.recurring.filter(r => r.direction === 'expense')
  const allIncome = data.recurring.filter(r => r.direction === 'income')

  const maxExpCat = data.avgExpensesByCategory[0]?.avgMonthly || 1
  const maxIncCat = data.avgIncomeByCategory[0]?.avgMonthly || 1

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
        <SummaryCard
          label="Verwachte inkomsten"
          value={formatEuro(data.forecastIncome)}
          sub="gemiddelde"
          colorClass="bg-green-50"
          icon={<TrendingUp size={16} className="text-green-600" />}
        />
        <SummaryCard
          label="Verwachte uitgaven"
          value={formatEuro(data.forecastExpenses)}
          sub="gemiddelde"
          colorClass="bg-red-50"
          icon={<TrendingDown size={16} className="text-red-500" />}
        />
        <SummaryCard
          label="Verwachte cashflow"
          value={formatEuro(data.forecastCashflow)}
          sub={data.forecastCashflow >= 0 ? 'positief' : 'negatief'}
          colorClass={data.forecastCashflow >= 0 ? 'bg-blue-50' : 'bg-orange-50'}
          icon={<ArrowLeftRight size={16} className={data.forecastCashflow >= 0 ? 'text-blue-600' : 'text-orange-500'} />}
        />
      </div>

      {/* Expected recurring next month */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Calendar size={16} className="text-blue-500" />
              Verwacht in {formatMonth(data.nextMonth)}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Terugkerende transacties op basis van patroon</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-red-500">{formatEuro(data.expectedRecurringExpenses)}</div>
            {data.expectedRecurringIncome > 0 && (
              <div className="text-sm font-semibold text-green-600">+{formatEuro(data.expectedRecurringIncome)}</div>
            )}
          </div>
        </div>

        {expectedExpenses.length === 0 && expectedIncome.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">Geen terugkerende transacties verwacht</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {expectedIncome.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">{r.listName || 'Geen categorie'}</span>
                    <FreqBadge label={r.frequencyLabel} freq={r.frequency} />
                  </div>
                </div>
                <div className="text-sm font-semibold text-green-600 whitespace-nowrap">
                  +{formatEuro(r.amount)}
                </div>
              </div>
            ))}
            {expectedExpenses.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">{r.listName || 'Geen categorie'}</span>
                    <FreqBadge label={r.frequencyLabel} freq={r.frequency} />
                  </div>
                </div>
                <div className="text-sm font-semibold text-red-500 whitespace-nowrap">
                  {formatEuro(r.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category averages grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Avg expenses */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Gem. uitgaven per categorie</h2>
            <p className="text-xs text-slate-400">Laatste 3 maanden</p>
          </div>
          <div className="p-4 space-y-3">
            {data.avgExpensesByCategory.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">Geen gegevens</p>
            )}
            {data.avgExpensesByCategory.map(cat => {
              const pct = Math.round((cat.avgMonthly / maxExpCat) * 100)
              return (
                <div key={cat.listName}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 truncate mr-2">{cat.listName}</span>
                    <span className="text-slate-600 shrink-0 font-medium">{formatEuro(cat.avgMonthly)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Avg income */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Gem. inkomsten per categorie</h2>
            <p className="text-xs text-slate-400">Laatste 3 maanden</p>
          </div>
          <div className="p-4 space-y-3">
            {data.avgIncomeByCategory.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">Geen gegevens</p>
            )}
            {data.avgIncomeByCategory.map(cat => {
              const pct = Math.round((cat.avgMonthly / maxIncCat) * 100)
              return (
                <div key={cat.listName}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 truncate mr-2">{cat.listName}</span>
                    <span className="text-slate-600 shrink-0 font-medium">{formatEuro(cat.avgMonthly)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* All recurring — collapsible */}
      {data.recurring.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowAllRecurring(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Repeat size={16} className="text-slate-500" />
              <span className="font-semibold text-slate-800">Alle terugkerende transacties</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{data.recurring.length}</span>
            </div>
            {showAllRecurring
              ? <ChevronDown size={16} className="text-slate-400" />
              : <ChevronRight size={16} className="text-slate-400" />
            }
          </button>

          {showAllRecurring && (
            <div>
              {/* Expenses section */}
              {allExpenses.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Uitgaven</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {allExpenses.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {r.listName && <span className="text-xs text-slate-400">{r.listName}</span>}
                            <FreqBadge label={r.frequencyLabel} freq={r.frequency} />
                            {r.expectedNextMonth && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                ✓ verwacht {formatMonth(
                                  (() => {
                                    const d = new Date()
                                    d.setMonth(d.getMonth() + 1)
                                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                                  })()
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-red-500">{formatEuro(r.amount)}</div>
                          <div className="text-xs text-slate-400">≈ {formatEuro(r.monthlyEquivalent)}/mnd</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {/* Income section */}
              {allIncome.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Inkomsten</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {allIncome.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {r.listName && <span className="text-xs text-slate-400">{r.listName}</span>}
                            <FreqBadge label={r.frequencyLabel} freq={r.frequency} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-green-600">+{formatEuro(r.amount)}</div>
                          <div className="text-xs text-slate-400">≈ {formatEuro(r.monthlyEquivalent)}/mnd</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
