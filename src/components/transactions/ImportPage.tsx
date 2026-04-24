'use client'

import { useRef, useState } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import clsx from 'clsx'

type Source = 'revolut' | 'crelan'

interface ImportResult {
  imported: number
  skipped: number
  duplicates: number
  errors: string[]
  total: number
}

export default function ImportPage() {
  const [source, setSource] = useState<Source>('revolut')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setResult(null)
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', source)

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
      <p className="text-slate-500 text-sm mb-6">Upload een CSV-bestand van Revolut of Crelan</p>

      {/* Source selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <label className="text-sm font-medium text-slate-700 mb-2 block">Bankbron</label>
        <div className="flex gap-3">
          {(['revolut', 'crelan'] as Source[]).map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
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

      {/* Info about expected format */}
      <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100">
        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <div>
          {source === 'revolut' ? (
            <span>Revolut: exporteer als CSV via Revolut app → Rekening → Exporteer. Kolommen: Type, Product, Startdatum, Datum voltooid, Beschrijving, Bedrag, Kosten, Valuta, Status, Saldo</span>
          ) : (
            <span>Crelan: exporteer transacties als CSV via Crelan Online. Kolommen: transactienummer, datum, omschrijving, tegenpartij, bedrag</span>
          )}
        </div>
      </div>

      {/* Drop zone */}
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
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

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

      {/* Import button */}
      <button
        disabled={!file || loading}
        onClick={handleImport}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Importeren...' : 'Importeren'}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Result */}
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
              <div className="font-medium mb-1">{result.errors.length} fout(en):</div>
              {result.errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
