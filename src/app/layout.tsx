import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/ui/AppShell'

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
