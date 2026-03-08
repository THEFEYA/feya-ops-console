import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/actions/ui-prefs?key=<key>
export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ value: null })
  }

  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return Response.json({ error: 'key is required' }, { status: 400 })

  try {
    const sb = createAdminClient()
    const { data } = await sb.from('ui_prefs').select('value').eq('key', key).maybeSingle()
    return Response.json({ value: data?.value ?? null })
  } catch {
    return Response.json({ value: null })
  }
}

// POST /api/actions/ui-prefs  { key, value } or { scope, key, label } for label_overrides
export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: { key?: string; value?: unknown; scope?: string; label?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sb = createAdminClient()

  // Label override write (ui_label_overrides table)
  if (body.scope && body.key) {
    const { error } = await sb.from('ui_label_overrides').upsert(
      { scope: body.scope, key: body.key, label: String(body.label ?? body.value ?? '') },
      { onConflict: 'scope,key' }
    )
    if (error) console.warn('[ui-prefs label_override] upsert failed:', error.message)
    return Response.json({ ok: true })
  }

  // Generic ui_prefs write: key text PK + value jsonb (actual schema)
  const { key, value } = body
  if (!key) return Response.json({ error: 'key is required' }, { status: 400 })

  const { error } = await sb.from('ui_prefs').upsert({ key, value }, { onConflict: 'key' })
  if (error) console.warn('[ui-prefs] upsert failed:', error.message)

  return Response.json({ ok: true })
}
