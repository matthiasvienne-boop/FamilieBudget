'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, ArrowLeftRight, AlertCircle, RefreshCw } from 'lucide-react'
import { formatEuro, formatMonth } from '@/lib/utils'
import clsx from 'clsx'

interface MonthlyStats {
  month: string
  income: number
  expenses: number
  cashflow: number
  transactionCount: number
}

interface CategoryBreakdown {
  listName: string
  total: number
  count: number
}

interface GroupBreakdown {
  listName: string
  groupName: string
  total: number
  count: number
}

interface DashboardData {
  monthlyStats: MonthlyStats[]
  expensesByList: CategoryBreakdown[]
  expensesByGroup: GroupBreakdown[]
  incomeByList: CategoryBreakdown[]
  uncategorized: number
  topMerchants: Array<{ name: string; total: number; count: number }>
}

function IncomeExpenseChart({ stats }: { stats: MonthlyStats[] }) {
  const W = 600
  const H = 160
  const PAD = { top: 16, right: 16, bottom: 28, left: 52 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const maxVal = Math.max(...stats.flatMap(s => [s.income, s.expenses]), 1)

  const xStep = innerW / Math.max(stats.length - 1, 1)
  const yScale = (v: number) => innerH - (v / maxVal) * innerH

  const toPath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * xStep} ${yScale(v)}`).join(' ')

  const incomePoints = stats.map(s => s.income)
  const expensePoints = stats.map(s => s.expenses)

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: yScale(maxVal * f),
    label: formatEuro(maxVal * f),
  }))

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Inkomsten vs uitgaven</h2>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> Inkomsten</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Uitgaven</span>
        </div>
      </div>
      <div className="p-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: '320px', height: '160px' }}>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {/* Y gridlines */}
            {yTicks.map((t, i) => (
              <g key={i}>
                <line x1={0} y1={t.y} x2={innerW} y2={t.y} stroke="#f1f5f9" strokeWidth={1} />
                <text x={-6} y={t.y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{t.label}</text>
              </g>
            ))}

            {/* Lines */}
            <path d={toPath(incomePoints)} fill="none" stroke="#22c55e" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={toPath(expensePoints)} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {/* Dots */}
            {incomePoints.map((v, i) => (
              <circle key={i} cx={i * xStep} cy={yScale(v)} r={3} fill="#22c55e" />
            ))}
            {expensePoints.map((v, i) => (
              <circle key={i} cx={i * xStep} cy={yScale(v)} r={3} fill="#ef4444" />
            ))}

            {/* X labels */}
            {stats.map((s, i) => {
              const [y, m] = s.month.split('-')
              return (
                <text key={i} x={i * xStep} y={innerH + 18} textAnchor="middle" fontSize={9} fill="#94a3b8">
                  {m}/{y.slice(2)}
                </text>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={clsx('p-2 rounded-lg', color)}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data) return <div className="text-red-500">Kon dashboard niet laden.</div>

  const currentMonth = data.monthlyStats[0]
  const prevMonth = data.monthlyStats[1]

  return (
    <div className="space-y-6">
      {/* Alert: uncategorized */}
      {data.uncategorized > 0 && (
        <Link href="/transactions?uncategorized=true" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors">
          <AlertCircle size={20} className="text-amber-500 shrink-0" />
          <div>
            <div className="font-medium text-amber-800">{data.uncategorized} ongecategoriseerde transacties</div>
            <div className="text-sm text-amber-600">Klik om te categoriseren →</div>
          </div>
        </Link>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Inkomsten (huidige maand)"
          value={formatEuro(currentMonth?.income ?? 0)}
          sub={prevMonth ? `vorige: ${formatEuro(prevMonth.income)}` : undefined}
          icon={<TrendingUp size={16} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Uitgaven (huidige maand)"
          value={formatEuro(currentMonth?.expenses ?? 0)}
          sub={prevMonth ? `vorige: ${formatEuro(prevMonth.expenses)}` : undefined}
          icon={<TrendingDown size={16} className="text-red-500" />}
          color="bg-red-50"
        />
        <StatCard
          label="Cashflow"
          value={formatEuro(currentMonth?.cashflow ?? 0)}
          sub={(currentMonth?.cashflow ?? 0) >= 0 ? 'positief' : 'negatief'}
          icon={<ArrowLeftRight size={16} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Transacties"
          value={String(currentMonth?.transactionCount ?? 0)}
          sub="deze maand"
          icon={<RefreshCw size={16} className="text-slate-500" />}
          color="bg-slate-50"
        />
      </div>

      {/* Income vs Expenses chart */}
      {data.monthlyStats.length > 1 && (
        <IncomeExpenseChart stats={[...data.monthlyStats].reverse()} />
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly overview table */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Maandoverzicht</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">Maand</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Inkomsten</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Uitgaven</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Cashflow</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyStats.slice(0, 6).map(m => (
                  <tr key={m.month} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{formatMonth(m.month)}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{formatEuro(m.income)}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{formatEuro(m.expenses)}</td>
                    <td className={clsx(
                      'px-4 py-2.5 text-right font-medium',
                      m.cashflow >= 0 ? 'text-green-700' : 'text-red-600'
                    )}>
                      {formatEuro(m.cashflow)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Uitgaven per categorie</h2>
            <p className="text-xs text-slate-400">Huidige maand</p>
          </div>
          <div className="p-4 space-y-4">
            {data.expensesByList.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">Geen uitgaven gevonden</p>
            )}
            {data.expensesByList.slice(0, 8).map(cat => {
              const maxTotal = data.expensesByList[0]?.total || 1
              const pct = Math.round((cat.total / maxTotal) * 100)
              const groups = data.expensesByGroup.filter(
                g => g.listName === cat.listName && g.groupName !== ''
              )
              return (
                <div key={cat.listName}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 font-semibold truncate mr-2">{cat.listName}</span>
                    <span className="text-slate-600 shrink-0 font-medium">{formatEuro(cat.total)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {groups.length > 0 && (
                    <div className="pl-3 border-l-2 border-slate-100 space-y-1">
                      {groups.map(g => (
                        <div key={g.groupName} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 truncate mr-2">{g.groupName}</span>
                          <span className="text-slate-400 shrink-0">{formatEuro(g.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top merchants */}
      {data.topMerchants.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Top handelaars (huidige maand)</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {data.topMerchants.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-5">{i + 1}</span>
                  <span className="text-sm text-slate-700">{m.name}</span>
                  <span className="text-xs text-slate-400">{m.count}×</span>
                </div>
                <span className="text-sm font-medium text-red-600">{formatEuro(m.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
