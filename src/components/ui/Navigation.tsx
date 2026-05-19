'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  Settings,
  RepeatIcon,
  Target,
  LogOut,
  MoreHorizontal,
  X,
} from 'lucide-react'
import clsx from 'clsx'

const mainLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transacties', icon: ArrowLeftRight },
  { href: '/budget', label: 'Budget', icon: Target },
  { href: '/import', label: 'Importeren', icon: Upload },
]

const moreLinks = [
  { href: '/recurring', label: 'Terugkerend', icon: RepeatIcon },
  { href: '/settings', label: 'Instellingen', icon: Settings },
]

const allLinks = [...mainLinks, ...moreLinks]

export default function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  if (mobile) {
    const moreActive = moreLinks.some(l => pathname.startsWith(l.href))
    return (
      <>
        {/* More sheet */}
        {moreOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
            <div
              className="absolute bottom-16 left-0 right-0 bg-white border-t border-slate-200 rounded-t-2xl shadow-xl px-4 pt-4 pb-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700">Meer</span>
                <button onClick={() => setMoreOpen(false)} className="p-1 text-slate-400">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-1">
                {moreLinks.map(({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors',
                        active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                      {label}
                    </Link>
                  )
                })}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={20} strokeWidth={1.8} />
                  Afmelden
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-around py-1">
          {mainLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs transition-colors min-w-[56px]',
                  active ? 'text-blue-600' : 'text-slate-500'
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="leading-tight">{label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={clsx(
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs transition-colors min-w-[56px]',
              moreActive || moreOpen ? 'text-blue-600' : 'text-slate-500'
            )}
          >
            <MoreHorizontal size={22} strokeWidth={1.8} />
            <span className="leading-tight">Meer</span>
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-slate-100">
        <h1 className="text-lg font-bold text-slate-900">💰 FamilieBudget</h1>
        <p className="text-xs text-slate-500 mt-0.5">Gezinsbudget 2026</p>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {allLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">Vienne Gezin</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          title="Afmelden"
        >
          <LogOut size={14} />
          Afmelden
        </button>
      </div>
    </div>
  )
}
