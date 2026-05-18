'use client'

import { useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Upload, FileText, Sparkles, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const TRANSACTION_FIELDS = [
  { value: 'transactionDate', label: 'Datum', required: true },
  { value: 'amount', label: 'Bedrag', required: true },
  { value: 'description', label: 'Omschrijving' },
  { value: 'counterparty', label: 'Tegenpartij' },
  { value: 'merchant', label: 'Handelaar' },
  { value: 'currency', label: 'Valuta' },
  { value: 'completedDate', label: 'Verwerkingsdatum' },
  { value: 'balanceAfterTransaction', label: 'Saldo na transactie' },
  { value: 'transactionType', label: 'Type transactie' },
  { value: 'notes', label: 'Notities' },
]

interface AIMapResult {
  headers: string[]
  sampleRows: string[][]
  delimiter: string
  aiMapping: Record<string, string | null>
  aiError?: string
}

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
}

interface Props {
  onClose: () => void
  onDone: () => void
  accounts?: AccountOption[]
  selectedAccountId?: string
}

export default function AIImportModal({ onClose, onDone, accounts = [], selectedAccountId: initialAccountId = '' }: Props) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'done'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [mapResult, setMapResult] = useState<AIMapResult | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')
  const [accountId, setAccountId] = useState(initialAccountId)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setAnalyzeError('')
  }

  const handleAnalyze = async () => {
    if (!file) return
    setAnalyzing(true)
    setAnalyzeError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/import/ai-map', { method: 'POST', body: formData })
      const data: AIMapResult = await res.json()

      if (!res.ok) throw new Error((data as { error?: string }).error || 'Analyse mislukt')

      setMapResult(data)

      // Pre-fill mapping from AI suggestion
      const initial: Record<string, string> = {}
      for (const [csvCol, field] of Object.entries(data.aiMapping)) {
        if (field && data.headers.includes(csvCol)) {
          initial[csvCol] = field
        }
      }
      setMapping(initial)
      setStep('mapping')
    } catch (e) {
      setAnalyzeError(String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  const handleImport = async () => {
    if (!file || !mapResult) return
    setImporting(true)
    setImportError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mapping', JSON.stringify(mapping))
      formData.append('delimiter', mapResult.delimiter)
      if (accountId) formData.append('accountId', accountId)

      const res = await fetch('/api/import/generic', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Import mislukt')
      setImportResult(data)
      setStep('done')
    } catch (e) {
      setImportError(String(e))
    } finally {
      setImporting(false)
    }
  }

  const mappedFields = new Set(Object.values(mapping).filter(Boolean))
  const hasMandatory = mappedFields.has('transactionDate') && mappedFields.has('amount')

  return (
    <Modal open onClose={onClose} title="Universele AI-import" size="lg">
      <div className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {['upload', 'mapping', 'done'].map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={12} />}
              <span className={clsx('font-medium', step === s ? 'text-blue-600' : step > s ? 'text-green-600' : '')}>
                {i + 1}. {s === 'upload' ? 'Bestand' : s === 'mapping' ? 'Velden koppelen' : 'Resultaat'}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            <p className="text-sm text-slate-500">
              Upload een CSV van <strong>elke bank</strong>. AI analyseert automatisch de kolommen en stelt een koppeling voor.
            </p>

            <div
              className={clsx(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                dragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-slate-300'
              )}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText size={32} className="text-green-500" />
                  <div className="font-medium text-slate-800">{file.name}</div>
                  <div className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · klik om te wijzigen</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={32} className="text-slate-300" />
                  <div className="font-medium text-slate-600">CSV slepen of klikken</div>
                  <div className="text-xs text-slate-400">Elke bankexport (CSV)</div>
                </div>
              )}
            </div>

            {accounts.length > 0 && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Rekening (optioneel)</label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">— Geen rekening koppelen —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}{a.bank ? ` (${a.bank})` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {analyzeError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                <AlertCircle size={14} /> {analyzeError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-medium">
                Annuleren
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!file || analyzing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
              >
                <Sparkles size={15} />
                {analyzing ? 'AI analyseert...' : 'Analyseren met AI'}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Field mapping */}
        {step === 'mapping' && mapResult && (
          <>
            <div className="text-sm text-slate-500">
              Controleer de koppeling van CSV-kolommen naar transactievelden. Rood gemarkeerde velden zijn verplicht.
            </div>

            {mapResult.aiError && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                {mapResult.aiError} — stel de koppeling handmatig in.
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="text-xs w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {mapResult.headers.map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-slate-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapResult.sampleRows.slice(0, 2).map((row, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1 text-slate-600 max-w-[120px] truncate">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mapping UI */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {mapResult.headers.map(header => {
                const currentField = mapping[header] || ''
                const isRequired = currentField === 'transactionDate' || currentField === 'amount'
                return (
                  <div key={header} className="flex items-center gap-3">
                    <div className="w-36 text-sm font-medium text-slate-700 truncate shrink-0">{header}</div>
                    <span className="text-slate-300 shrink-0">→</span>
                    <select
                      value={currentField}
                      onChange={e => setMapping(prev => ({ ...prev, [header]: e.target.value }))}
                      className={clsx(
                        'flex-1 text-sm border rounded-lg px-2 py-1.5 bg-white',
                        isRequired ? 'border-blue-300' : 'border-slate-200'
                      )}
                    >
                      <option value="">— Niet importeren —</option>
                      {TRANSACTION_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>

            {!hasMandatory && (
              <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2">
                Koppel minstens Datum (*) en Bedrag (*) om te kunnen importeren.
              </div>
            )}

            {importError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                <AlertCircle size={14} /> {importError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep('upload')} className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-medium">
                Terug
              </button>
              <button
                onClick={handleImport}
                disabled={!hasMandatory || importing}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {importing ? 'Importeren...' : 'Importeren'}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 'done' && importResult && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={20} className="text-green-500" />
              <h3 className="font-semibold text-slate-800">Import voltooid</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-green-50 rounded-xl p-3">
                <div className="text-2xl font-bold text-green-700">{importResult.imported}</div>
                <div className="text-xs text-green-600">Geïmporteerd</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <div className="text-2xl font-bold text-amber-700">{importResult.duplicates}</div>
                <div className="text-xs text-amber-600">Duplicaten</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-2xl font-bold text-slate-700">{importResult.total}</div>
                <div className="text-xs text-slate-500">Totaal</div>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="text-xs text-red-600 mt-2">{importResult.errors.length} rijen overgeslagen</div>
            )}
            <button
              onClick={onDone}
              className="w-full mt-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium"
            >
              Naar transacties
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
