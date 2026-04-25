'use client'

import { useEffect, useState } from 'react'
import { TransactionList, TransactionGroup, ClassificationRule } from '@/types'
import { Plus, Trash2, Edit2, Check, X, ChevronRight, Tag, Zap, Users, Sparkles, LogOut } from 'lucide-react'
import clsx from 'clsx'

const COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#84cc16', '#14b8a6', '#6366f1', '#94a3b8', '#ef4444',
]

type Tab = 'lists' | 'rules' | 'users' | 'ai'

interface User {
  id: string
  email: string
  name: string
  role: string
  isActive: number
  createdAt: string
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('lists')
  const [lists, setLists] = useState<TransactionList[]>([])
  const [groups, setGroups] = useState<TransactionGroup[]>([])
  const [rules, setRules] = useState<ClassificationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedList, setExpandedList] = useState<string | null>(null)

  // Forms
  const [newListName, setNewListName] = useState('')
  const [newListColor, setNewListColor] = useState(COLORS[0])
  const [addingList, setAddingList] = useState(false)
  const [editListId, setEditListId] = useState<string | null>(null)
  const [editListName, setEditListName] = useState('')

  const [newGroupName, setNewGroupName] = useState('')
  const [addingGroupForList, setAddingGroupForList] = useState<string | null>(null)
  const [editGroupId, setEditGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')

  const [newRule, setNewRule] = useState({
    matchType: 'description_contains',
    matchValue: '',
    listName: '',
    groupName: '',
    isRecurring: false,
    applyToFutureImports: true,
  })
  const [addingRule, setAddingRule] = useState(false)

  // Users tab
  const [users, setUsers] = useState<User[]>([])
  const [addingUser, setAddingUser] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'member' })
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null)

  // AI tab
  const [apiKey, setApiKey] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [loadingApiKey, setLoadingApiKey] = useState(false)

  const reload = async () => {
    const [listsRes, rulesRes, meRes] = await Promise.all([
      fetch('/api/lists').then(r => r.json()),
      fetch('/api/rules').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
    ])
    setLists(listsRes.lists || [])
    setGroups(listsRes.groups || [])
    setRules(rulesRes)
    if (meRes) setCurrentUser(meRes)
    setLoading(false)
  }

  const reloadUsers = async () => {
    const res = await fetch('/api/auth/users')
    if (res.ok) setUsers(await res.json())
  }

  const reloadApiKey = async () => {
    setLoadingApiKey(true)
    const res = await fetch('/api/settings/anthropic-key')
    if (res.ok) {
      const data = await res.json()
      setApiKey(data.masked || '')
    }
    setLoadingApiKey(false)
  }

  useEffect(() => { reload() }, [])

  const addList = async () => {
    if (!newListName.trim()) return
    await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListName.trim(), color: newListColor }),
    })
    setNewListName(''); setAddingList(false)
    reload()
  }

  const saveListEdit = async (id: string) => {
    if (!editListName.trim()) return
    await fetch('/api/lists', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editListName.trim() }),
    })
    setEditListId(null)
    reload()
  }

  const deleteList = async (id: string) => {
    if (!confirm('Lijst verwijderen? Alle transacties worden ongecategoriseerd.')) return
    await fetch(`/api/lists?id=${id}`, { method: 'DELETE' })
    reload()
  }

  const addGroup = async (listId: string, listName: string) => {
    if (!newGroupName.trim()) return
    await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId, listName, name: newGroupName.trim() }),
    })
    setNewGroupName(''); setAddingGroupForList(null)
    reload()
  }

  const saveGroupEdit = async (id: string) => {
    if (!editGroupName.trim()) return
    await fetch('/api/groups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editGroupName.trim() }),
    })
    setEditGroupId(null)
    reload()
  }

  const deleteGroup = async (id: string) => {
    await fetch(`/api/groups?id=${id}`, { method: 'DELETE' })
    reload()
  }

  const addRule = async () => {
    if (!newRule.matchValue.trim()) return
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newRule,
        recurringType: newRule.isRecurring ? 'recurring' : 'one_time',
      }),
    })
    setNewRule({ matchType: 'description_contains', matchValue: '', listName: '', groupName: '', isRecurring: false, applyToFutureImports: true })
    setAddingRule(false)
    reload()
  }

  const deleteRule = async (id: string) => {
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' })
    reload()
  }

  const listGroups = (listName: string) => groups.filter(g => g.listName === listName)
  const ruleGroups = groups.filter(g => g.listName === newRule.listName)

  if (loading) return <div className="p-6 text-slate-400">Laden...</div>

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Instellingen</h1>
      <p className="text-slate-500 text-sm mb-6">Beheer uw lijsten, groepen en classificatieregels</p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1 mb-6">
        {[
          { id: 'lists', label: 'Lijsten & Groepen', icon: Tag },
          { id: 'rules', label: 'Regels', icon: Zap },
          { id: 'users', label: 'Gebruikers', icon: Users },
          { id: 'ai', label: 'AI', icon: Sparkles },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setTab(id as Tab)
              if (id === 'users') reloadUsers()
              if (id === 'ai') reloadApiKey()
            }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* LISTS & GROUPS TAB */}
      {tab === 'lists' && (
        <div className="space-y-3">
          {lists.map(list => (
            <div key={list.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              {/* List header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: list.color || '#94a3b8' }}
                />
                {editListId === list.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      value={editListName}
                      onChange={e => setEditListName(e.target.value)}
                      className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm"
                      onKeyDown={e => e.key === 'Enter' && saveListEdit(list.id)}
                      autoFocus
                    />
                    <button onClick={() => saveListEdit(list.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditListId(null)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 font-medium text-slate-800">{list.name}</span>
                    <span className="text-xs text-slate-400 mr-2">{listGroups(list.name).length} groepen</span>
                    <button
                      onClick={() => { setEditListId(list.id); setEditListName(list.name) }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => deleteList(list.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => setExpandedList(expandedList === list.id ? null : list.id)}
                      className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg"
                    >
                      <ChevronRight
                        size={15}
                        className={clsx('transition-transform', expandedList === list.id && 'rotate-90')}
                      />
                    </button>
                  </>
                )}
              </div>

              {/* Groups */}
              {expandedList === list.id && (
                <div className="border-t border-slate-50 bg-slate-50 px-4 py-3 space-y-2">
                  {listGroups(list.name).map(g => (
                    <div key={g.id} className="flex items-center gap-2">
                      {editGroupId === g.id ? (
                        <>
                          <input
                            value={editGroupName}
                            onChange={e => setEditGroupName(e.target.value)}
                            className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white"
                            onKeyDown={e => e.key === 'Enter' && saveGroupEdit(g.id)}
                            autoFocus
                          />
                          <button onClick={() => saveGroupEdit(g.id)} className="p-1 text-green-600"><Check size={14} /></button>
                          <button onClick={() => setEditGroupId(null)} className="p-1 text-slate-400"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-slate-400 mr-1">•</span>
                          <span className="flex-1 text-sm text-slate-700">{g.name}</span>
                          <button
                            onClick={() => { setEditGroupId(g.id); setEditGroupName(g.name) }}
                            className="p-1 text-slate-300 hover:text-slate-500"
                          ><Edit2 size={12} /></button>
                          <button
                            onClick={() => deleteGroup(g.id)}
                            className="p-1 text-slate-300 hover:text-red-500"
                          ><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add group */}
                  {addingGroupForList === list.id ? (
                    <div className="flex gap-2 mt-1">
                      <input
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        placeholder="Naam groep..."
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                        onKeyDown={e => e.key === 'Enter' && addGroup(list.id, list.name)}
                        autoFocus
                      />
                      <button onClick={() => addGroup(list.id, list.name)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                        Toevoegen
                      </button>
                      <button onClick={() => setAddingGroupForList(null)} className="px-2 py-1.5 text-slate-400 hover:text-slate-600">
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingGroupForList(list.id)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 mt-1"
                    >
                      <Plus size={12} /> Groep toevoegen
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add list */}
          {addingList ? (
            <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
              <input
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                placeholder="Naam nieuwe lijst..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                onKeyDown={e => e.key === 'Enter' && addList()}
                autoFocus
              />
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewListColor(c)}
                    className={clsx(
                      'w-6 h-6 rounded-full border-2 transition-transform',
                      newListColor === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={addList} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium">
                  Aanmaken
                </button>
                <button onClick={() => setAddingList(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600">
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingList(true)}
              className="flex items-center gap-2 w-full px-4 py-3 bg-white border border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Plus size={16} /> Nieuwe lijst aanmaken
            </button>
          )}
        </div>
      )}

      {/* RULES TAB */}
      {tab === 'rules' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
            Classificatieregels worden automatisch toegepast bij nieuwe imports. Ze matchen transacties op basis van omschrijving, tegenpartij of bedrag.
          </div>

          {rules.map(rule => (
            <div key={rule.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                      {rule.matchType}
                    </span>
                    <span className="text-sm font-medium text-slate-800">"{rule.matchValue}"</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                    {rule.listName && <span>→ {rule.listName}</span>}
                    {rule.groupName && <span>/ {rule.groupName}</span>}
                    {rule.isRecurring && <span className="text-purple-600">recurring</span>}
                    {rule.applyToFutureImports && <span className="text-green-600">toekomstige imports</span>}
                  </div>
                </div>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {rules.length === 0 && !addingRule && (
            <div className="text-center py-6 text-slate-400 text-sm">
              Geen regels gevonden. Regels worden aangemaakt vanuit de transactielijst via "Bestaande + toekomstige imports".
            </div>
          )}

          {/* Add rule form */}
          {addingRule ? (
            <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Match type</label>
                  <select
                    value={newRule.matchType}
                    onChange={e => setNewRule(r => ({ ...r, matchType: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="description_contains">Omschrijving bevat</option>
                    <option value="counterparty_exact">Tegenpartij exact</option>
                    <option value="merchant_exact">Handelaar exact</option>
                    <option value="amount_exact">Bedrag exact</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Waarde</label>
                  <input
                    value={newRule.matchValue}
                    onChange={e => setNewRule(r => ({ ...r, matchValue: e.target.value }))}
                    placeholder="bv. Colruyt"
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Lijst</label>
                  <select
                    value={newRule.listName}
                    onChange={e => setNewRule(r => ({ ...r, listName: e.target.value, groupName: '' }))}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">— Geen —</option>
                    {lists.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Groep</label>
                  <select
                    value={newRule.groupName}
                    onChange={e => setNewRule(r => ({ ...r, groupName: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                    disabled={!newRule.listName}
                  >
                    <option value="">— Geen —</option>
                    {ruleGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRule.isRecurring}
                    onChange={e => setNewRule(r => ({ ...r, isRecurring: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  Recurring
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRule.applyToFutureImports}
                    onChange={e => setNewRule(r => ({ ...r, applyToFutureImports: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  Toepassen op imports
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={addRule} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Regel aanmaken
                </button>
                <button onClick={() => setAddingRule(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600">
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingRule(true)}
              className="flex items-center gap-2 w-full px-4 py-3 bg-white border border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Plus size={16} /> Nieuwe regel aanmaken
            </button>
          )}
        </div>
      )}
      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Beheer gezinsleden die toegang hebben tot FamilieBudget.</p>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                window.location.href = '/auth/login'
              }}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg px-3 py-1.5"
            >
              <LogOut size={13} /> Afmelden
            </button>
          </div>

          {users.map(user => (
            <div key={user.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-800">{user.name}</div>
                <div className="text-xs text-slate-500">{user.email} · {user.role === 'admin' ? 'Beheerder' : 'Lid'}</div>
              </div>
              <div className="flex items-center gap-2">
                {!user.isActive && <span className="text-xs text-red-500 border border-red-200 rounded-full px-2 py-0.5">Inactief</span>}
                {currentUser?.role === 'admin' && user.id !== currentUser?.id && (
                  <button
                    onClick={async () => {
                      await fetch('/api/auth/users', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: user.id, isActive: !user.isActive }),
                      })
                      reloadUsers()
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-2 py-1"
                  >
                    {user.isActive ? 'Deactiveren' : 'Activeren'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {currentUser?.role === 'admin' && (
            addingUser ? (
              <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
                <h3 className="font-medium text-slate-800 text-sm">Nieuw gezinslid toevoegen</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Naam</label>
                    <input value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Voornaam" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Rol</label>
                    <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="member">Lid</option>
                      <option value="admin">Beheerder</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">E-mailadres</label>
                  <input type="email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="naam@voorbeeld.be" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Wachtwoord</label>
                  <input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Minstens 6 tekens" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/auth/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newUser),
                      })
                      if (res.ok) {
                        setNewUser({ name: '', email: '', password: '', role: 'member' })
                        setAddingUser(false)
                        reloadUsers()
                      } else {
                        const err = await res.json()
                        alert(err.error || 'Aanmaken mislukt')
                      }
                    }}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Aanmaken
                  </button>
                  <button onClick={() => setAddingUser(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600">
                    Annuleren
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingUser(true)}
                className="flex items-center gap-2 w-full px-4 py-3 bg-white border border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                <Plus size={16} /> Gezinslid toevoegen
              </button>
            )
          )}
        </div>
      )}

      {/* AI TAB */}
      {tab === 'ai' && (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800">
            <p className="font-medium mb-1">AI-classificatie met Claude</p>
            <p className="text-purple-600">Voeg je Anthropic API-sleutel toe om automatische categoriesuggesties te activeren bij het klasseren van transacties.</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">Anthropic API-sleutel</label>
            {loadingApiKey ? (
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setApiKeySaved(false) }}
                  placeholder="sk-ant-..."
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                />
                <button
                  onClick={async () => {
                    const res = await fetch('/api/settings/anthropic-key', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ key: apiKey }),
                    })
                    if (res.ok) setApiKeySaved(true)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  {apiKeySaved ? '✓ Opgeslagen' : 'Opslaan'}
                </button>
              </div>
            )}
            <p className="text-xs text-slate-400">De sleutel wordt versleuteld opgeslagen in de database.</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-700 mb-1">Hoe werkt het?</p>
            <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside">
              <li>Open een transactie en klik op "AI-suggestie"</li>
              <li>Claude analyseert de omschrijving, handelaar en tegenpartij</li>
              <li>De lijst en groep worden automatisch ingevuld</li>
              <li>Je bevestigt of past de suggestie aan voor het opslaan</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
