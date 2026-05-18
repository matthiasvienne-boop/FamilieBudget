'use client'

import { useState, useEffect } from 'react'
import { formatDate } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { Send, BookOpen, Check, X } from 'lucide-react'
import clsx from 'clsx'

function fmtDate(s: string) { return formatDate((s ?? '').split('T')[0]) }

const STATUS_COLOR: Record<string, string> = {
  Nieuw: 'bg-blue-100 text-blue-700',
  'In behandeling': 'bg-amber-100 text-amber-700',
  Opgelost: 'bg-green-100 text-green-700',
  Gesloten: 'bg-slate-100 text-slate-600',
}

const SECTION_COLOR: Record<string, string> = {
  Transacties: 'bg-blue-100 text-blue-700',
  Budget: 'bg-purple-100 text-purple-700',
  Importeren: 'bg-orange-100 text-orange-700',
  Instellingen: 'bg-slate-100 text-slate-700',
  Dashboard: 'bg-slate-100 text-slate-700',
  Andere: 'bg-gray-100 text-gray-600',
}

const ALL_STATUSES = ['Nieuw', 'In behandeling', 'Opgelost', 'Gesloten']
const TODO_STATUSES = ['Nieuw', 'In behandeling']

interface FaqDraft { feedbackId: string; question: string; answer: string }

export default function AlleFeedback() {
  const [feedbackList, setFeedbackList] = useState<any[]>([])
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'todo' | 'afgewerkt'>('todo')
  const [faqDraft, setFaqDraft] = useState<FaqDraft | null>(null)
  const [faqSaving, setFaqSaving] = useState(false)

  const reload = async () => {
    const res = await fetch('/api/feedback?all=true')
    if (res.ok) setFeedbackList(await res.json())
  }

  useEffect(() => { reload() }, [])

  const handleStatus = async (id: string, status: string) => {
    await fetch(`/api/feedback/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    reload()
  }

  const handleReply = async (id: string) => {
    const text = replyTexts[id]
    if (!text?.trim()) return
    await fetch(`/api/feedback/${id}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, author: 'admin' }) })
    setReplyTexts(r => ({ ...r, [id]: '' }))
    reload()
  }

  const markRead = async (id: string) => {
    await fetch(`/api/feedback/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unread_by_admin: false }) })
    reload()
  }

  const openFaqDialog = (f: any) => {
    const lastReply = Array.isArray(f.replies)
      ? [...f.replies].reverse().find((r: any) => r.author === 'admin')?.message ?? f.admin_reply ?? ''
      : f.admin_reply ?? ''
    setFaqDraft({ feedbackId: f.id, question: f.title, answer: lastReply })
  }

  const saveFaq = async (question: string, answer: string) => {
    if (!faqDraft) return
    setFaqSaving(true)
    await fetch('/api/faq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, answer, is_published: true, source_feedback_id: faqDraft.feedbackId, order_index: 0 }) })
    setFaqSaving(false)
    setFaqDraft(null)
  }

  const todo = feedbackList.filter(f => TODO_STATUSES.includes(f.status))
  const afgewerkt = feedbackList.filter(f => !TODO_STATUSES.includes(f.status))
  const shown = tab === 'todo' ? todo : afgewerkt
  const todoUnread = todo.filter(f => f.unread_by_admin).length

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <h1 className="text-2xl font-bold text-slate-900">Alle Feedback</h1>

      <div className="flex gap-2">
        <button onClick={() => setTab('todo')}
          className={clsx('px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2', tab === 'todo' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
          Todo
          {todoUnread > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{todoUnread}</span>}
        </button>
        <button onClick={() => setTab('afgewerkt')}
          className={clsx('px-4 py-1.5 rounded-full text-sm font-medium transition-colors', tab === 'afgewerkt' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
          Afgewerkt ({afgewerkt.length})
        </button>
      </div>

      <div className="space-y-4">
        {shown.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">Geen feedback</div>
        ) : shown.map((f: any) => (
          <div key={f.id} className={clsx('bg-white rounded-xl border p-4 space-y-3', f.unread_by_admin ? 'border-blue-400' : 'border-slate-100')}>
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <h3 className="font-medium text-slate-900 flex items-center gap-2">
                  {f.unread_by_admin && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                  {f.title}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', SECTION_COLOR[f.section] ?? SECTION_COLOR['Andere'])}>
                    {f.section ?? 'Andere'}
                  </span>
                  <span className="text-xs text-slate-400">{f.type} · {f.created_by} · {fmtDate(f.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {f.unread_by_admin && (
                  <button onClick={() => markRead(f.id)} className="text-xs text-slate-500 hover:text-slate-700 underline whitespace-nowrap">Gelezen</button>
                )}
                <button onClick={() => openFaqDialog(f)} title="Naar FAQ pushen"
                  className="flex items-center gap-1 text-xs px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <BookOpen size={13} /> FAQ
                </button>
                <select value={f.status} onChange={e => handleStatus(f.id, e.target.value)}
                  className="text-xs px-2 py-1 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <p className="text-sm text-slate-700">{f.message}</p>

            {Array.isArray(f.replies) && f.replies.length > 0 && (
              <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                {f.replies.map((r: any) => (
                  <div key={r.id} className={clsx('rounded-lg px-3 py-2 text-sm', r.author === 'admin' ? 'bg-blue-50' : 'bg-slate-50')}>
                    <p className="text-xs font-medium text-slate-400 mb-1">{r.author === 'admin' ? 'Beheerder' : f.created_by} · {fmtDate(r.created_at)}</p>
                    <p>{r.message}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input placeholder="Antwoord schrijven..." value={replyTexts[f.id] ?? ''}
                onChange={e => setReplyTexts(r => ({ ...r, [f.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleReply(f.id)}
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => handleReply(f.id)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Send size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {faqDraft && (
        <FaqDialog draft={faqDraft} saving={faqSaving} onSave={saveFaq} onCancel={() => setFaqDraft(null)} />
      )}
    </div>
  )
}

function FaqDialog({ draft, saving, onSave, onCancel }: { draft: FaqDraft; saving: boolean; onSave: (q: string, a: string) => void; onCancel: () => void }) {
  const [question, setQuestion] = useState(draft.question)
  const [answer, setAnswer] = useState(draft.answer)
  return (
    <Modal open onClose={onCancel} title="Naar FAQ pushen">
      <div className="space-y-4">
        <p className="text-xs text-slate-500">Verwijder persoonsgegevens voor je opslaat.</p>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Vraag</label>
          <input value={question} onChange={e => setQuestion(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Antwoord</label>
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={5}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
            <X size={14} /> Annuleren
          </button>
          <button onClick={() => onSave(question, answer)} disabled={!question.trim() || !answer.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            <Check size={14} /> {saving ? 'Opslaan...' : 'Toevoegen aan FAQ'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
