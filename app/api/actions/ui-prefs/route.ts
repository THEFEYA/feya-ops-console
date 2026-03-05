import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: { scope?: string; key?: string; value?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { scope, key, value } = body
  if (!scope || !key) {
    return Response.json({ error: 'scope and key are required' }, { status: 400 })
  }

  const sb = createAdminClient()

  // Upsert into ui_prefs — table may or may not have this exact schema
  // Try label_overrides table first for label scope
  if (scope === 'label_override') {
    const { error } = await sb.from('ui_label_overrides').upsert(
      { scope, key, label: String(value ?? ''), updated_at: new Date().toISOString() },
      { onConflict: 'scope,key' }
    )
    if (error) {
      // table may not exist — fall through to ui_prefs
      const { error: e2 } = await sb.from('ui_prefs').upsert(
        { scope, key, value, updated_at: new Date().toISOString() },
        { onConflict: 'scope,key' }
      )
      if (e2) console.warn('[ui-prefs] upsert failed:', e2.message)
    }
    return Response.json({ ok: true })
  }

  // Generic ui_prefs upsert
  const { error } = await sb.from('ui_prefs').upsert(
    { scope, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'scope,key' }
  )
  if (error) {
    console.warn('[ui-prefs] upsert failed:', error.message)
    // Non-fatal — state is in localStorage
  }

  return Response.json({ ok: true })
}
