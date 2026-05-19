'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, Info, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import AIImportModal from './AIImportModal'

type Source = 'revolut' | 'crelan'
type Tab = 'bank' | 'universal'

interface ImportResult {
  imported: number
  skipped: number
  duplicates: number
  errors: string[]
  total: number
}

interface AccountOption {
  id: string
  name: string
  bank: string | null
  color: string | null
}

function extractRevolutProducts(csvText: string): string[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const productIdx = headers.indexOf('Product')
  if (productIdx === -1) return []
  const products = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const val = (cols[productIdx] || '').trim().replace(/^"|"$/g, '')
    if (val) products.add(val)
  }
  return Array.from(products).sort()
}

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>('bank')
  const [source, setSource] = useState<Source>('revolut')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAIImport, setShowAIImport] = useState(false)
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [productMap, setProductMap] = useState<Record<string, string>>({})
  const [revolutProducts, setRevolutProducts] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/accounts').then(r => r.ok ? r.json() : []).then(setAccounts)
  }, [])

  const handleFile = async (f: File) => {
    setFile(f); setResult(null); setError(null); setProductMap({}); setRevolutProducts([])
    if (source === 'revolut') {
      const text = await f.text()
      const products = extractRevolutProducts(text)
      setRevolutProducts(products)
      const initial: Record<string, string> = {}
      products.forEach(p => { initial[p] = '' })
      setProductMap(initial)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }

  const handleSourceChange = (s: Source) => {
    setSource(s)
    setRevolutProducts([])
    setProductMap({})
    setFile(null)
    setResult(null)
    setError(null)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', source)
      if (selectedAccountId) formData.append('accountId', selectedAccountId)

      const filteredMap = Object.fromEntries(
        Object.entries(productMap).filter(([, v]) => v !== '')
      )
      if (Object.keys(filteredMap).length > 0) {
        formData.append('productAccountMap', JSON.stringify(filteredMap))
      }

      const res = await fetch('/api/import', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Import mislukt')
      setResult(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Transacties importeren</h1>
      <p className="text-slate-500 text-sm mb-5">Importeer bankbestanden automatisch of gebruik AI voor elke bankindeling</p>

      {/* Tab selector */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
        <button
          onClick={() => setTab('bank')}
          className={clsx(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'bank' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          🏦 Revolut / Crelan
        </button>
        <button
          onClick={() => setTab('universal')}
          className={clsx(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
            tab === 'universal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Sparkles size={14} />
          Universele AI-import
        </button>
      </div>

      {tab === 'bank' && (
        <>
          {/* Source selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <label className="text-sm font-medium text-slate-700 mb-2 block">Bankbron</label>
            <div className="flex gap-3">
              {(['revolut', 'crelan'] as Source[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleSourceChange(s)}
                  className={clsx(
                    'flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-colors capitalize',
                    source === s
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  )}
                >
                  {s === 'revolut' ? '💳 Revolut' : '🏦 Crelan'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100">
            <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
              {source === 'revolut' ? (
                <span>Revolut: exporteer als CSV via Revolut app → Rekening → Exporteer.</span>
              ) : (
                <span>Crelan: exporteer transacties als CSV via Crelan Online Banking.</span>
              )}
            </div>
          </div>

          <div
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4',
              dragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-white hover:border-slate-300'
            )}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".csv" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText size={32} className="text-green-500" />
                <div className="font-medium text-slate-800">{file.name}</div>
                <div className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</div>
                <div className="text-xs text-slate-400">Klik om een ander bestand te kiezen</div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={32} className="text-slate-300" />
                <div className="font-medium text-slate-600">Bestand slepen of klikken</div>
                <div className="text-sm text-slate-400">CSV-bestand</div>
              </div>
            )}
          </div>

          {source === 'revolut' && revolutProducts.length > 0 && (
            <div className="mb-4 bg-white rounded-xl border border-slate-200 p-4">
              <label className="text-sm font-medium text-slate-700 mb-3 block">
                Koppel producten aan rekeningen
              </label>
              <div className="space-y-2.5">
                {revolutProducts.map(product => (
                  <div key={product} className="flex items-center gap-3">
                    <span className="text-sm text-slate-700 w-40 shrink-0 font-medium">{product}</span>
                    <select
                      value={productMap[product] ?? ''}
                      onChange={e => setProductMap(m => ({ ...m, [product]: e.target.value }))}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="">— Niet koppelen —</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ''}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {source === 'crelan' && accounts.length > 0 && (
            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Rekening (optioneel)</label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              >
                <option value="">— Geen rekening koppelen —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <button
            disabled={!file || loading}
            onClick={handleImport}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Importeren...' : 'Importeren'}
          </button>

          {error && (
            <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {result && (
            <div className="mt-4 bg-white border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={18} className="text-green-500" />
                <h3 className="font-semibold text-slate-800">Import voltooid</h3>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-700">{result.imported}</div>
                  <div className="text-xs text-green-600">Geïmporteerd</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-amber-700">{result.duplicates}</div>
                  <div className="text-xs text-amber-600">Duplicaten overgeslagen</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-slate-700">{result.total}</div>
                  <div className="text-xs text-slate-500">Totaal in bestand</div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3 text-xs text-red-600">
                  {result.errors.length} fout(en) overgeslagen
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'universal' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto">
            <Sparkles size={28} className="text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">Universele AI-import</h3>
            <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
              Upload een CSV van <strong>elke bank</strong>. Claude AI analyseert automatisch de kolomstructuur
              en stelt een veldkoppeling voor die je kan aanpassen vóór de import.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-lg mb-1">📤</div>
              <div className="font-medium text-slate-700">Upload CSV</div>
              <div>Elke bankexport</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-lg mb-1">🤖</div>
              <div className="font-medium text-slate-700">AI analyseert</div>
              <div>Automatische kolommen</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-lg mb-1">✅</div>
              <div className="font-medium text-slate-700">Importeer</div>
              <div>Na jouw controle</div>
            </div>
          </div>
          <button
            onClick={() => setShowAIImport(true)}
            className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={16} />
            Starten met AI-import
          </button>
        </div>
      )}

      {showAIImport && (
        <AIImportModal
          onClose={() => setShowAIImport(false)}
          onDone={() => { setShowAIImport(false); window.location.href = '/transactions' }}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
        />
      )}
    </div>
  )
}
