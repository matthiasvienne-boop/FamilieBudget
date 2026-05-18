import type { Metadata } from 'next'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'FamilieBudget — Gezinsfinanciën eenvoudig gemaakt',
  description:
    'Importeer bankafschriften van Revolut en Crelan, laat AI uw uitgaven automatisch categoriseren, en behoud altijd het overzicht voor uw heel gezin.',
  keywords: [
    'gezinsbudget', 'familiebudget', 'budgetbeheer', 'bankimport', 'Revolut', 'Crelan',
    'AI classificatie', 'uitgaven bijhouden', 'persoonlijke financiën België',
  ],
  openGraph: {
    title: 'FamilieBudget — Gezinsfinanciën eenvoudig gemaakt',
    description:
      'Importeer bankafschriften, laat AI categoriseren en behoud het overzicht. Voor het hele gezin.',
    type: 'website',
    locale: 'nl_BE',
    siteName: 'FamilieBudget',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FamilieBudget — Gezinsfinanciën eenvoudig gemaakt',
    description: 'Importeer bankafschriften, laat AI categoriseren en behoud het overzicht.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
}

export default async function HomePage() {
  const session = await getSession()
  if (session) redirect('/dashboard')
  return <LandingPage />
}
