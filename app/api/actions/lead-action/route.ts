import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import {
  getLeadActions,
  createLeadAction,
  updateLeadActionStatus,
  ACTION_TYPES,
  type ActionType,
} from '@/lib/api/leadActions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/actions/lead-action?lead_id=<id>
 *  Returns all actions for the lead, newest first. */
export async function GET(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  const leadId = req.nextUrl.searchParams.get('lead_id')
  if (!leadId) {
    return Response.json({ error: 'lead_id is required' }, { status: 400 })
  }

  const result = await getLeadActions(leadId)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 })
  }
  return Response.json({ data: result.data })
}

/** POST /api/actions/lead-action
 *  Body: { lead_id, action_type, note?, due_at?, actor_label? }
 *  Creates a new planned action. */
export async function POST(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { lead_id, action_type, note, due_at, actor_label, meta } = body as {
    lead_id?:     string | number
    action_type?: string
    note?:        string
    due_at?:      string
    actor_label?: string
    meta?:        Record<string, unknown>
  }

  if (!lead_id) {
    return Response.json({ error: 'lead_id is required' }, { status: 400 })
  }
  if (!action_type || !(ACTION_TYPES as readonly string[]).includes(action_type)) {
    return Response.json(
      { error: `action_type must be one of: ${ACTION_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const result = await createLeadAction(lead_id, action_type as ActionType, {
    note,
    due_at,
    actor_label,
    meta,
  })

  if (!result.ok) {
    console.error('[lead-action POST]', result.error)
    return Response.json({ error: result.error }, { status: 500 })
  }
  return Response.json({ ok: true, data: result.data })
}

/** PATCH /api/actions/lead-action
 *  Body: { action_id, action_status }
 *  Updates status of an existing action to 'done' or 'canceled'. */
export async function PATCH(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action_id, action_status } = body as {
    action_id?:     string
    action_status?: string
  }

  if (!action_id) {
    return Response.json({ error: 'action_id is required' }, { status: 400 })
  }
  if (!action_status || !(['done', 'canceled'] as string[]).includes(action_status)) {
    return Response.json(
      { error: 'action_status must be "done" or "canceled"' },
      { status: 400 }
    )
  }

  const result = await updateLeadActionStatus(action_id, action_status as 'done' | 'canceled')

  if (!result.ok) {
    console.error('[lead-action PATCH]', result.error)
    return Response.json({ error: result.error }, { status: 500 })
  }
  return Response.json({ ok: true, data: result.data })
}
