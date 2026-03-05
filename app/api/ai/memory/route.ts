import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: { insight?: string; context?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { insight, context } = body
  if (!insight) {
    return Response.json({ error: 'insight is required' }, { status: 400 })
  }

  // Best-effort save to Supabase — table may not exist
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const sb = createAdminClient()
      await sb.from('ai_insights').insert({
        insight,
        context: context ?? null,
        created_at: new Date().toISOString(),
      })
    }
  } catch {
    // table may not exist yet — non-critical
  }

  return Response.json({ ok: true })
}
