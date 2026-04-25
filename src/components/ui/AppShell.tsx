'use client'

import { usePathname } from 'next/navigation'
import Navigation from './Navigation'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith('/auth/')

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="flex flex-col h-full md:flex-row">
      <aside className="hidden md:flex md:flex-col md:w-56 md:min-h-screen bg-white border-r border-slate-200 shrink-0">
        <Navigation />
      </aside>
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {children}
      </main>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
        <Navigation mobile />
      </nav>
    </div>
  )
}
