import { createAdminClient } from '../supabase/server'

export type OutcomeType = 'approved' | 'shortlisted' | 'rejected'

export type StageType =
  | 'shortlisted'
  | 'approved'
  | 'rejected'
  | 'qualified'
  | 'contacted'
  | 'replied'
  | 'meeting'
  | 'proposal'
  | 'won'
  | 'lost'

export interface StageHistoryRow {
  id: number | string
  lead_id: string | number
  stage?: string
  outcome?: string
  note?: string | null
  meta?: Record<string, unknown> | null
  created_at: string
}

/** Insert a new stage entry for a lead (history-style, not upsert).
 *  Dedup: if the latest existing entry for the same lead has the same stage
 *  and was created < 2 minutes ago, skip the insert. */
export async function insertLeadStage(
  leadId: string | number,
  stage: StageType,
  note?: string,
  meta: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: unknown; error?: string; skipped?: boolean }> {
  const sb = createAdminClient()

  // Dedup check: fetch the most recent entry for this lead
  try {
    const { data: recent } = await sb
      .from('lead_outcomes')
      .select('id, outcome, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent) {
      const existingStage = recent.outcome
      const ageMs = Date.now() - new Date(recent.created_at as string).getTime()
      if (existingStage === stage && ageMs < 2 * 60 * 1000) {
        return { ok: true, skipped: true }
      }
    }
  } catch {
    // If dedup check fails, proceed with insert
  }

  // Insert new stage row
  try {
    const { data, error } = await sb
      .from('lead_outcomes')
      .insert({
        lead_id: leadId,
        outcome: stage,     // use 'outcome' column (existing schema)
        meta: { ...meta, ...(note ? { note } : {}) },
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      // Fallback: try upsert if insert fails (e.g. unique constraint)
      const { data: upserted, error: upErr } = await sb
        .from('lead_outcomes')
        .upsert(
          {
            lead_id: leadId,
            outcome: stage,
            meta: { ...meta, ...(note ? { note } : {}) },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'lead_id' }
        )
        .select()
        .single()
      if (upErr) return { ok: false, error: upErr.message }
      return { ok: true, data: upserted }
    }
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/** Get the latest stage + last 10 history entries for a lead */
export async function getLeadStageHistory(
  leadId: string | number
): Promise<{ ok: boolean; data?: { latest: StageHistoryRow | null; history: StageHistoryRow[] }; error?: string }> {
  const sb = createAdminClient()
  try {
    const { data, error } = await sb
      .from('lead_outcomes')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) return { ok: false, error: error.message }

    const rows = (data ?? []) as StageHistoryRow[]
    return { ok: true, data: { latest: rows[0] ?? null, history: rows } }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

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
