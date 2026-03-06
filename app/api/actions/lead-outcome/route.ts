import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import { insertLeadStage, getLeadStageHistory } from '@/lib/api/actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALL_STAGES = [
  'shortlisted',
  'approved',
  'rejected',
  'qualified',
  'contacted',
  'replied',
  'meeting',
  'proposal',
  'won',
  'lost',
] as const

type StageType = (typeof ALL_STAGES)[number]

export async function GET(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  const leadId = req.nextUrl.searchParams.get('lead_id')
  if (!leadId) {
    return Response.json({ error: 'lead_id is required' }, { status: 400 })
  }

  const result = await getLeadStageHistory(leadId)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 })
  }

  return Response.json({ data: result.data })
}

export async function POST(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { lead_id, stage: stageRaw, outcome: outcomeRaw, note, meta = {} } = body as {
    lead_id?: string | number
    stage?: string
    outcome?: string  // backward compat alias
    note?: string
    meta?: Record<string, unknown>
  }

  // Accept either 'stage' or 'outcome' (legacy)
  const stage = (stageRaw ?? outcomeRaw) as StageType | undefined

  if (!lead_id) {
    return Response.json({ error: 'lead_id is required' }, { status: 400 })
  }

  if (!stage || !ALL_STAGES.includes(stage)) {
    return Response.json(
      { error: `stage must be one of: ${ALL_STAGES.join(', ')}` },
      { status: 400 }
    )
  }

  const result = await insertLeadStage(lead_id, stage, note, meta as Record<string, unknown>)

  if (!result.ok) {
    console.error('[lead-outcome POST] DB error:', result.error)
    return Response.json({ error: result.error }, { status: 500 })
  }

  if (result.skipped) {
    return Response.json({ ok: true, skipped: true, reason: 'duplicate_recent' })
  }

  return Response.json({ ok: true, data: result.data })
}
