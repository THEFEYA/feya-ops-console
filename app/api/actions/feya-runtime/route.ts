import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type FeyaRuntimeAction =
  | 'request_first_touch_draft'
  | 'request_followup_draft'
  | 'open_owner_control_handoff'

export async function POST(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = String(body.action ?? '') as FeyaRuntimeAction
  const leadId = String(body.lead_id ?? '')
  const requestedBy = String(body.requested_by ?? 'ops_console')
  const handoffReason = String(body.handoff_reason ?? 'Требуется личная проверка')

  if (!leadId) return Response.json({ error: 'lead_id is required' }, { status: 400 })
  if (!action) return Response.json({ error: 'action is required' }, { status: 400 })

  const sb = createAdminClient().schema('feya_sales')

  try {
    switch (action) {
      case 'request_first_touch_draft': {
        const { data, error } = await sb.rpc('request_first_touch_draft', {
          p_lead_id: leadId,
          p_requested_by: requestedBy,
        })
        if (error) return Response.json({ error: error.message }, { status: 500 })
        return Response.json({ ok: true, data })
      }
      case 'request_followup_draft': {
        const { data, error } = await sb.rpc('request_followup_draft', {
          p_lead_id: leadId,
          p_requested_by: requestedBy,
        })
        if (error) return Response.json({ error: error.message }, { status: 500 })
        return Response.json({ ok: true, data })
      }
      case 'open_owner_control_handoff': {
        const { data, error } = await sb.rpc('open_owner_control_handoff', {
          p_lead_id: leadId,
          p_handoff_reason: handoffReason,
          p_requested_by: requestedBy,
        })
        if (error) return Response.json({ error: error.message }, { status: 500 })
        return Response.json({ ok: true, data })
      }
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
