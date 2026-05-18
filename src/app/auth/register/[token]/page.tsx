'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  const [invite, setInvite] = useState<{ email: string; name: string } | null>(null)
  const [inviteError, setInviteError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/auth/register/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setInviteError(data.error)
        else setInvite(data)
      })
      .catch(() => setInviteError('Kon uitnodiging niet laden'))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Wachtwoorden komen niet overeen'); return }
    if (password.length < 8) { setError('Wachtwoord moet minstens 8 tekens zijn'); return }

    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/register/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError(data.error || 'Registratie mislukt')
      }
    } catch {
      setError('Er is een fout opgetreden')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💰</div>
          <h1 className="text-2xl font-bold text-slate-900">FamilieBudget</h1>
          <p className="text-slate-500 text-sm mt-1">Maak je account aan</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          {inviteError ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">⚠️</div>
              <p className="text-red-600 font-medium">{inviteError}</p>
              <p className="text-slate-500 text-sm mt-2">Vraag een nieuwe uitnodiging aan de beheerder.</p>
            </div>
          ) : !invite ? (
            <p className="text-center text-slate-400 text-sm py-4">Uitnodiging laden...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm">
                <p className="text-slate-500">Uitgenodigd als</p>
                <p className="font-semibold text-slate-800">{invite.name}</p>
                <p className="text-slate-500">{invite.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kies een wachtwoord</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="Minimaal 8 tekens"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Bevestig wachtwoord</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white rounded-xl py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {loading ? 'Account aanmaken...' : 'Account aanmaken'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
