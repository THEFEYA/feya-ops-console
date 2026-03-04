import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import { setLeadOutcome, OutcomeType } from '@/lib/api/actions'

const ALLOWED_OUTCOMES: OutcomeType[] = ['approved', 'shortlisted', 'rejected']

export async function POST(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { lead_id, outcome, meta = {} } = body as {
    lead_id?: string | number
    outcome?: string
    meta?: Record<string, unknown>
  }

  if (!lead_id) {
    return Response.json({ error: 'lead_id is required' }, { status: 400 })
  }

  if (!outcome || !ALLOWED_OUTCOMES.includes(outcome as OutcomeType)) {
    return Response.json(
      { error: `outcome must be one of: ${ALLOWED_OUTCOMES.join(', ')}` },
      { status: 400 }
    )
  }

  const result = await setLeadOutcome(lead_id, outcome as OutcomeType, meta as Record<string, unknown>)

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 })
  }

  return Response.json({ ok: true, data: result.data })
}
