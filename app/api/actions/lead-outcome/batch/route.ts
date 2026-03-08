import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import { getLeadStageBatch } from '@/lib/api/actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST body: { lead_ids: string[] }
 *  Response: { map: { [lead_id]: { stage, created_at } } } */
export async function POST(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const lead_ids = body.lead_ids
  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return Response.json({ map: {} })
  }

  const ids = (lead_ids as unknown[]).slice(0, 500).map(String) // cap at 500

  const result = await getLeadStageBatch(ids)
  if (!result.ok) {
    console.error('[lead-outcome/batch] error:', result.error)
    return Response.json({ error: result.error }, { status: 500 })
  }

  return Response.json({ map: result.map })
}
