'use client'

import { useState, useEffect } from 'react'
import { formatDate } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { Plus, MessageSquare, Send } from 'lucide-react'
import clsx from 'clsx'

function fmtDate(s: string) { return formatDate((s ?? '').split('T')[0]) }

const STATUS_COLOR: Record<string, string> = {
  Nieuw: 'bg-blue-100 text-blue-700',
  'In behandeling': 'bg-amber-100 text-amber-700',
  Opgelost: 'bg-green-100 text-green-700',
  Gesloten: 'bg-slate-100 text-slate-600',
}

const SECTIONS = ['Dashboard', 'Transacties', 'Budget', 'Importeren', 'Instellingen', 'Andere']
const TYPES = ['Bug', 'Suggestie', 'Vraag', 'Andere']

export default function MyFeedback() {
  const [feedbackList, setFeedbackList] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', message: '', type: 'Suggestie', section: 'Andere' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [replyOpen, setReplyOpen] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  const reload = async () => {
    const res = await fetch('/api/feedback')
    if (res.ok) setFeedbackList(await res.json())
  }

  useEffect(() => { reload() }, [])

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) { setError('Titel en bericht zijn verplicht'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, page: window.location.pathname }),
      })
      if (!res.ok) throw new Error()
      setModalOpen(false)
      setForm({ title: '', message: '', type: 'Suggestie', section: 'Andere' })
      reload()
    } catch { setError('Versturen mislukt') }
    finally { setSaving(false) }
  }

  const handleReply = async (id: string) => {
    if (!replyText.trim()) return
    setReplying(true)
    await fetch(`/api/feedback/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: replyText, author: 'user' }),
    })
    setReplyOpen(null); setReplyText(''); setReplying(false)
    reload()
  }

  const markRead = async (id: string) => {
    await fetch(`/api/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unread_by_user: false }),
    })
    reload()
  }

  const unreadCount = feedbackList.filter(f => f.unread_by_user).length

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mijn Feedback</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-blue-600 mt-0.5">{unreadCount} nieuw antwoord{unreadCount > 1 ? 'en' : ''}</p>
          )}
        </div>
        <button
          onClick={() => { setModalOpen(true); setError('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Nieuw
        </button>
      </div>

      <div className="space-y-4">
        {feedbackList.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
            Nog geen feedback ingediend
          </div>
        ) : feedbackList.map((f: any) => (
          <div key={f.id} className={clsx('bg-white rounded-xl border p-4 space-y-3', f.unread_by_user ? 'border-blue-400' : 'border-slate-100')}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-slate-900 flex items-center gap-2">
                  {f.unread_by_user && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                  {f.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{f.type} · {fmtDate(f.created_at)}</p>
              </div>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_COLOR[f.status] ?? 'bg-slate-100 text-slate-600')}>
                {f.status}
              </span>
            </div>

            <p className="text-sm text-slate-700">{f.message}</p>

            {Array.isArray(f.replies) && f.replies.length > 0 && (
              <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                {f.replies.map((r: any) => (
                  <div key={r.id} className={clsx('rounded-lg px-3 py-2 text-sm', r.author === 'admin' ? 'bg-blue-50' : 'bg-slate-50')}>
                    <p className="text-xs font-medium text-slate-400 mb-1">
                      {r.author === 'admin' ? 'Beheerder' : 'Jij'} · {fmtDate(r.created_at)}
                    </p>
                    <p>{r.message}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {f.unread_by_user && (
                <button onClick={() => markRead(f.id)} className="text-xs text-slate-500 hover:text-slate-700 underline">
                  Als gelezen markeren
                </button>
              )}
              {f.status !== 'Gesloten' && (
                replyOpen === f.id ? (
                  <div className="flex gap-2 w-full">
                    <input
                      placeholder="Vervolg bericht..."
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleReply(f.id)}
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button onClick={() => handleReply(f.id)} disabled={replying} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      <Send size={16} />
                    </button>
                    <button onClick={() => { setReplyOpen(null); setReplyText('') }} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
                      Annuleren
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setReplyOpen(f.id); setReplyText('') }} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                    <MessageSquare size={14} /> Beantwoorden
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Feedback indienen">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Titel *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Rubriek</label>
            <select value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {SECTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Bericht *</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Annuleren</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Versturen...' : 'Versturen'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
