import { getSession, JWTPayload } from './auth'
import { NextResponse } from 'next/server'

type AuthResult = { session: JWTPayload; error: null } | { session: null; error: NextResponse }

export async function requireAuth(): Promise<AuthResult> {
  const session = await getSession()
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  }
  return { session, error: null }
}

export async function requireAdmin(): Promise<AuthResult> {
  const session = await getSession()
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  }
  if (session.role !== 'admin') {
    return { session: null, error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }
  return { session, error: null }
}
