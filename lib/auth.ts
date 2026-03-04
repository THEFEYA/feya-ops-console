import { NextRequest } from 'next/server'
import { validateDashboardToken } from './supabase/server'

/**
 * Extract token from request: first checks ?t=, then Authorization header,
 * then feya_token cookie.
 */
export function extractToken(req: NextRequest): string {
  return (
    req.nextUrl.searchParams.get('t') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.cookies.get('feya_token')?.value ??
    ''
  )
}

/**
 * Validate request token. Returns true if valid or if token check is disabled.
 */
export async function authorizeRequest(req: NextRequest): Promise<boolean> {
  if (process.env.FEYA_DASH_TOKEN_REQUIRED === 'false') return true
  const token = extractToken(req)
  return validateDashboardToken(token)
}

export function unauthorizedResponse(message = 'Нет доступа') {
  return Response.json({ error: message }, { status: 401 })
}
