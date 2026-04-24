import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/ui/Navigation'

export const metadata: Metadata = {
  title: 'FamilieBudget',
  description: 'Persoonlijk gezinsbudgetbeheer',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900">
        <div className="flex flex-col h-full md:flex-row">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex md:flex-col md:w-56 md:min-h-screen bg-white border-r border-slate-200 shrink-0">
            <Navigation />
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto pb-20 md:pb-0">
            {children}
          </main>

          {/* Mobile bottom nav */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
            <Navigation mobile />
          </nav>
        </div>
      </body>
    </html>
  )
}
