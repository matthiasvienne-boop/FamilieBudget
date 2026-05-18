'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  BarChart3, BrainCircuit, Target, Users, Upload, Scissors,
  Check, ChevronRight, ArrowRight, Shield, Repeat,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Upload,
    title: 'Automatische bankimport',
    desc: 'Import CSV-bestanden van Revolut en Crelan in één klik. Duplicaten worden automatisch herkend en overgeslagen.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: BrainCircuit,
    title: 'AI-classificatie',
    desc: 'Claude AI categoriseert uw transacties automatisch op basis van handelaar, omschrijving en bedrag. Eén klik, klaar.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Target,
    title: 'Budgetdoelen per categorie',
    desc: 'Stel maandelijkse doelen in per rubriek. Visuele voortgang en historische vergelijking helpen u op koers blijven.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: BarChart3,
    title: 'Overzicht & grafieken',
    desc: 'Interactieve maandgrafieken voor inkomsten vs. uitgaven. Klik door tot op transactieniveau voor elk bedrag.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Users,
    title: 'Gezinsbeheer',
    desc: 'Meerdere gezinsleden, één overzicht. Beheer rollen, activeer of deactiveer accounts als admin.',
    color: 'bg-pink-50 text-pink-600',
  },
  {
    icon: Scissors,
    title: 'Visa-splitsing',
    desc: 'Visa-transacties automatisch splitsen over meerdere categorieën met precies de juiste bedragen.',
    color: 'bg-indigo-50 text-indigo-600',
  },
]

const PLANS = [
  {
    name: 'Gratis',
    price: '€0',
    period: 'voor altijd',
    yearlyNote: undefined,
    highlight: false,
    features: [
      '1 gebruiker',
      'Revolut & Crelan CSV-import',
      'Universele AI-import (100 transacties)',
      'AI-classificatiesuggesties',
      'Budgetdoelen & grafieken',
      'Onbeperkte transactiehistoriek',
    ],
    cta: 'Gratis starten',
    ctaHref: '/auth/login',
  },
  {
    name: 'Gezin',
    price: '€4,99',
    period: 'per maand',
    yearlyNote: 'of €49,99/jaar (2 maanden gratis)',
    highlight: true,
    features: [
      'Onbeperkt gebruikers',
      'Revolut & Crelan CSV-import',
      'Universele AI-import (onbeperkt)',
      'Onbeperkte AI-classificatie',
      'Budgetdoelen & grafieken',
      'Onbeperkte transactiehistoriek',
      'Prioritaire e-mail ondersteuning',
    ],
    cta: 'Kies Gezin',
    ctaHref: '/auth/login',
  },
]

const STEPS = [
  { n: '1', title: 'Account aanmaken', desc: 'Registreer uw gezin in 30 seconden. Geen creditcard vereist.' },
  { n: '2', title: 'Bank importeren', desc: 'Upload CSV-bestanden van Revolut of Crelan. AI classificeert alles automatisch.' },
  { n: '3', title: 'Overzicht bewaken', desc: 'Bekijk dashboards, stel budgetdoelen in en houd uw gezinsfinanciën onder controle.' },
]

export default function LandingPage() {
  const [yearly, setYearly] = useState(false)

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* ── Navigation ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>💰</span>
            <span className="font-bold text-lg text-slate-900">FamilieBudget</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <button onClick={() => scrollTo('features')} className="hover:text-slate-900 transition-colors">Functies</button>
            <button onClick={() => scrollTo('how')} className="hover:text-slate-900 transition-colors">Hoe het werkt</button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-slate-900 transition-colors">Prijzen</button>
          </nav>
          <Link
            href="/auth/login"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Aanmelden <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-20 pb-24 px-4 md:px-6 text-center bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Shield size={14} />
            Geen installatie — wij regelen alles voor u
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
            Uw gezinsfinanciën,<br />
            <span className="text-blue-600">eindelijk onder controle</span>
          </h1>
          <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto">
            Importeer bankafschriften van Revolut en Crelan, laat AI uw uitgaven automatisch categoriseren,
            en behoud altijd het overzicht — voor uw heel gezin.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors text-base shadow-lg shadow-blue-200"
            >
              Gratis beginnen <ChevronRight size={18} />
            </Link>
            <button
              onClick={() => scrollTo('features')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-slate-200 text-slate-700 rounded-2xl font-semibold hover:bg-slate-50 transition-colors text-base"
            >
              Alle functies bekijken
            </button>
          </div>
        </div>

        {/* Dashboard preview mockup */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <div className="ml-3 text-xs text-slate-400 font-mono">familiebudget.app/dashboard</div>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Inkomsten mei', value: '€ 5.240', color: 'text-green-600' },
                { label: 'Uitgaven mei', value: '€ 3.180', color: 'text-red-500' },
                { label: 'Gespaard', value: '€ 2.060', color: 'text-blue-600' },
                { label: 'Ongecategoriseerd', value: '12', color: 'text-amber-600' },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-50 rounded-xl p-4">
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 grid grid-cols-3 gap-3">
              {['Wonen 42%', 'Voeding 18%', 'Transport 12%', 'Vrije tijd 11%', 'Kinderen 9%', 'Overige 8%'].map(cat => (
                <div key={cat} className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 font-medium">{cat}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 px-4 md:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Alles wat uw gezin nodig heeft</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Van automatische bankimport tot AI-classificatie — FamilieBudget neemt de administratie uit uw handen.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <article key={f.title} className="bg-slate-50 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon size={22} />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-20 px-4 md:px-6 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">In 3 stappen aan de slag</h2>
            <p className="text-slate-500 text-lg">Geen installatie, geen technische kennis vereist.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map(step => (
              <div key={step.n} className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-lg font-bold mx-auto mb-4">
                  {step.n}
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 px-4 md:px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Transparante prijzen</h2>
            <p className="text-slate-500 text-lg mb-6">Kies het plan dat bij uw gezin past. Geen verborgen kosten.</p>
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1">
              <button
                onClick={() => setYearly(false)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${!yearly ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Maandelijks
              </button>
              <button
                onClick={() => setYearly(true)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${yearly ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Jaarlijks
                <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 ${yearly ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>-17%</span>
              </button>
            </div>
            <p className="text-sm text-slate-400 mt-3">Gezinsplan jaarlijks: <strong className="text-slate-600">€49,99/jaar</strong> — 2 maanden gratis</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 flex flex-col ${plan.highlight
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-200'
                  : 'bg-white border border-slate-200'
                }`}
              >
                <div className="mb-5">
                  <div className={`text-sm font-semibold mb-1 ${plan.highlight ? 'text-blue-200' : 'text-slate-400'}`}>{plan.name}</div>
                  <div className="flex items-end gap-1 mb-0.5">
                    <span className={`text-3xl font-extrabold ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                    {plan.period && (
                      <span className={`text-sm pb-1 ${plan.highlight ? 'text-blue-200' : 'text-slate-400'}`}>/{plan.period.replace('per maand', 'maand')}</span>
                    )}
                  </div>
                  {plan.yearlyNote && yearly && (
                    <div className={`text-xs ${plan.highlight ? 'text-blue-200' : 'text-slate-400'}`}>{plan.yearlyNote}</div>
                  )}
                  {!plan.yearlyNote && (
                    <div className={`text-xs ${plan.highlight ? 'text-blue-200' : 'text-slate-400'}`}>{plan.period}</div>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2 text-sm">
                      <Check size={15} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-blue-200' : 'text-green-500'}`} />
                      <span className={plan.highlight ? 'text-blue-50' : 'text-slate-600'}>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaHref}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${plan.highlight
                    ? 'bg-white text-blue-600 hover:bg-blue-50'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            Alle prijzen excl. BTW. Abonnement maandelijks opzegbaar. Jaarplanning betaald vooraf.
          </p>
        </div>
      </section>

      {/* ── Trust / CTA ── */}
      <section className="py-20 px-4 md:px-6 bg-white text-center">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-center gap-8 mb-10 flex-wrap">
            {[
              { icon: Shield, label: 'Veilig & privé', sub: 'Uw financiële data is alleen van u' },
              { icon: Repeat, label: 'Automatisch', sub: 'Classificatieregels leren mee' },
              { icon: Users, label: 'Gezinsvriendelijk', sub: 'Meerdere gebruikers, één overzicht' },
            ].map(t => (
              <div key={t.label} className="flex flex-col items-center gap-1.5 max-w-[140px]">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <t.icon size={20} className="text-slate-600" />
                </div>
                <div className="font-semibold text-slate-800 text-sm">{t.label}</div>
                <div className="text-xs text-slate-400 text-center">{t.sub}</div>
              </div>
            ))}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Klaar om te starten?</h2>
          <p className="text-slate-500 mb-6">Probeer FamilieBudget 30 dagen gratis. Geen creditcard vereist.</p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors text-base shadow-lg shadow-blue-200"
          >
            Gratis beginnen <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 py-8 px-4 md:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-semibold text-slate-600">FamilieBudget</span>
            <span>— Gezinsfinancials eenvoudig gemaakt</span>
          </div>
          <div className="flex gap-6">
            <button onClick={() => scrollTo('features')} className="hover:text-slate-600 transition-colors">Functies</button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-slate-600 transition-colors">Prijzen</button>
            <Link href="/auth/login" className="hover:text-slate-600 transition-colors">Aanmelden</Link>
          </div>
          <div>© {new Date().getFullYear()} FamilieBudget</div>
        </div>
      </footer>
    </div>
  )
}
