import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/no-access', '/favicon.ico', '/_next', '/api/auth', '/debug']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow API routes to handle their own auth
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // Allow public/static paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  // Skip token check if disabled — parse as boolean to handle 'false'/'False'/'FALSE' etc.
  const tokenRequired = (process.env.FEYA_DASH_TOKEN_REQUIRED ?? 'true').trim().toLowerCase() === 'true'
  if (!tokenRequired) return NextResponse.next()

  // Get token from ?t= param or cookie
  const tokenParam = req.nextUrl.searchParams.get('t')
  const tokenCookie = req.cookies.get('feya_token')?.value
  const token = tokenParam ?? tokenCookie ?? ''

  if (!token) {
    return NextResponse.redirect(new URL('/no-access', req.url))
  }

  // Validate token — compare with env var (fast, no network)
  const envToken = process.env.FEYA_DASH_TOKEN
  if (envToken && token !== envToken) {
    return NextResponse.redirect(new URL('/no-access', req.url))
  }

  // Set token cookie if coming from ?t= param, then redirect to clean URL
  if (tokenParam) {
    const res = NextResponse.redirect(new URL(pathname, req.url))
    res.cookies.set('feya_token', tokenParam, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
