import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'fb_token'

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required')
  return new TextEncoder().encode(jwtSecret)
}

const PUBLIC_PREFIXES = ['/auth/', '/api/auth/']
const PUBLIC_EXACT = new Set(['/', '/favicon.ico'])

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  if (isPublic) return NextResponse.next()

  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/auth/login', request.url))
    response.cookies.delete(COOKIE_NAME)
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.png$|.*\\.svg$|.*\\.ico$).*)'],
}
