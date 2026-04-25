'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  Settings,
  RepeatIcon,
  Target,
} from 'lucide-react'
import clsx from 'clsx'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transacties', icon: ArrowLeftRight },
  { href: '/budget', label: 'Budget', icon: Target },
  { href: '/import', label: 'Importeren', icon: Upload },
  { href: '/recurring', label: 'Recurring', icon: RepeatIcon },
  { href: '/settings', label: 'Instellingen', icon: Settings },
]

export default function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname()

  if (mobile) {
    return (
      <div className="flex items-center justify-around py-2">
        {links.slice(0, 4).map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors',
                active ? 'text-blue-600' : 'text-slate-500'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          )
        })}
        <Link
          href="/settings"
          className={clsx(
            'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors',
            pathname === '/settings' ? 'text-blue-600' : 'text-slate-500'
          )}
        >
          <Settings size={22} strokeWidth={pathname === '/settings' ? 2.5 : 1.8} />
          <span>Meer</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-slate-100">
        <h1 className="text-lg font-bold text-slate-900">💰 FamilieBudget</h1>
        <p className="text-xs text-slate-500 mt-0.5">Gezinsbudget 2026</p>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
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
      <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
        Vienne Gezin
      </div>
    </div>
  )
}
