import { createAdminClient } from '../supabase/server'

export type OutcomeType = 'approved' | 'shortlisted' | 'rejected'

/** Whitelisted Supabase edge function names */
export const ALLOWED_EDGE_FUNCTIONS = [
  'collector_serp_serper',
  'collector_reddit_rss',
  'extract_people_reddit',
  'extract_people_rpf',
  'digest_email_daily',
  'collector_google_places',
  'collector_osm_overpass',
  'lead_outcome_action',
] as const

export type AllowedEdgeFunction = (typeof ALLOWED_EDGE_FUNCTIONS)[number]

export function isAllowedFunction(name: string): name is AllowedEdgeFunction {
  return ALLOWED_EDGE_FUNCTIONS.includes(name as AllowedEdgeFunction)
}

/** Call a whitelisted Supabase edge function server-side */
export async function callEdgeFunction(
  name: AllowedEdgeFunction,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const sb = createAdminClient()

  try {
    const { data, error } = await sb.functions.invoke(name, {
      body: payload,
    })

    if (error) {
      return { ok: false, error: error.message ?? String(error) }
    }
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/** Set lead outcome — tries edge function first, falls back to direct upsert */
export async function setLeadOutcome(
  leadId: string | number,
  outcome: OutcomeType,
  meta: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const sb = createAdminClient()

  // Try lead_outcome_action edge function
  const edgeResult = await callEdgeFunction('lead_outcome_action', {
    lead_id: leadId,
    outcome,
    meta,
  })

  if (edgeResult.ok) return edgeResult

  // Fallback: direct upsert into lead_outcomes table
  try {
    const { data, error } = await sb
      .from('lead_outcomes')
      .upsert(
        {
          lead_id: leadId,
          outcome,
          meta,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'lead_id' }
      )
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Edge fn failed: ${edgeResult.error}; Upsert fallback failed: ${message}` }
  }
}
