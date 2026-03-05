import { createAdminClient } from '../supabase/server'
import { NormalisedLead, NormalisedRun, normaliseLead, normaliseRun } from '../field-resolver'

export type InboxTab = 'b2b_hot' | 'people_hot' | 'event_review' | 'extract_people'

const INBOX_VIEW_MAP: Record<InboxTab, string> = {
  b2b_hot: 'mv_inbox_b2b_hot',
  people_hot: 'mv_inbox_people_hot',
  event_review: 'mv_inbox_event_review',
  extract_people: 'mv_inbox_extract_people',
}

/** Throw a rich error that carries Supabase details so callers get full context. */
function sbError(context: string, err: { message: string; details?: string | null; hint?: string | null }) {
  const parts = [err.message, err.details, err.hint].filter(Boolean).join(' | ')
  const e = new Error(`[${context}] ${parts}`) as Error & { sbDetails?: string; sbHint?: string }
  e.sbDetails = err.details ?? undefined
  e.sbHint = err.hint ?? undefined
  return e
}

export async function getKpiToday() {
  const sb = createAdminClient()
  const { data, error } = await sb.from('v_kpi_today').select('*').limit(1).maybeSingle()
  if (error) throw sbError('getKpiToday', error)
  return data ?? {}
}

export interface InboxOpts {
  limit?: number
  scoreMin?: number
  scoreMax?: number
  warmth?: string
  source?: string
  country?: string
  search?: string
  status?: string
}

export interface InboxResult {
  rows: NormalisedLead[]
  debug: {
    resolvedTable: string
    appliedFilters: Record<string, unknown>
    limit: number
  }
}

export async function getInbox(tab: InboxTab, opts: InboxOpts = {}): Promise<InboxResult> {
  const sb = createAdminClient()
  const view = INBOX_VIEW_MAP[tab]
  const limit = opts.limit ?? 200

  let query = sb.from(view).select('*').order('created_at', { ascending: false }).limit(limit)

  const appliedFilters: Record<string, unknown> = {}

  // Best-effort filters — only applied if column may exist
  if (opts.warmth) { query = query.ilike('warmth', opts.warmth); appliedFilters.warmth = opts.warmth }
  if (opts.source) { query = query.ilike('source_slug', `%${opts.source}%`); appliedFilters.source_slug = opts.source }
  // country is not in all views — filtering is done client-side in the UI
  if (opts.status) { query = query.eq('status', opts.status); appliedFilters.status = opts.status }
  if (opts.search) { query = query.or(`title.ilike.%${opts.search}%,url.ilike.%${opts.search}%`); appliedFilters.search = opts.search }
  if (opts.scoreMin != null) { query = query.gte('score', opts.scoreMin); appliedFilters.scoreMin = opts.scoreMin }
  if (opts.scoreMax != null) { query = query.lte('score', opts.scoreMax); appliedFilters.scoreMax = opts.scoreMax }

  const { data, error } = await query
  if (error) throw sbError(`getInbox:${tab}`, error)

  return {
    rows: (data ?? []).map(normaliseLead),
    debug: { resolvedTable: view, appliedFilters, limit },
  }
}

export async function getRunsRecent(limit = 200): Promise<NormalisedRun[]> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw sbError('getRunsRecent', error)
  return (data ?? []).map(normaliseRun)
}

export async function getTasksStats() {
  const sb = createAdminClient()
  const { data, error } = await sb.from('tasks').select('status').limit(2000)
  if (error) throw sbError('getTasksStats', error)
  const rows = data ?? []
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const s = (r as Record<string, string>).status ?? 'unknown'
    counts[s] = (counts[s] ?? 0) + 1
  }
  return counts
}

export async function getRecentErrors(limit = 50) {
  const sb = createAdminClient()
  const { data: taskErrors } = await sb
    .from('tasks')
    .select('*')
    .in('status', ['error', 'failed', 'failed_retried'])
    .order('created_at', { ascending: false })
    .limit(limit)
  const { data: runErrors } = await sb
    .from('runs')
    .select('*')
    .in('status', ['error', 'failed'])
    .order('created_at', { ascending: false })
    .limit(limit)
  return [...(taskErrors ?? []), ...(runErrors ?? [])].slice(0, limit)
}

export async function getPipelineNodeStats() {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('tasks')
    .select('status, node, created_at')
    .limit(5000)
  if (error) throw sbError('getPipelineNodeStats', error)
  return data ?? []
}

export async function getLeadAnalytics() {
  const sb = createAdminClient()
  // Select both source_slug and source — whichever the table actually has will be non-null
  const { data: leads, error: leadsErr } = await sb
    .from('leads')
    .select('source_slug, source, warmth, country, created_at, score')
    .limit(5000)
  if (leadsErr) throw sbError('getLeadAnalytics:leads', leadsErr)

  const { data: outcomes, error: outcomesErr } = await sb
    .from('lead_outcomes')
    .select('outcome, created_at')
    .limit(5000)
  if (outcomesErr) throw sbError('getLeadAnalytics:outcomes', outcomesErr)

  return { leads: leads ?? [], outcomes: outcomes ?? [] }
}

export async function getSchemaKeys() {
  const sb = createAdminClient()
  const sources: Record<string, string[]> = {}

  const tables = [
    'leads', 'tasks', 'runs', 'signals', 'decision_log', 'domain_rules',
    'sources', 'queries', 'lead_outcomes', 'digests', 'signal_detectors', 'keyword_master',
  ]
  const views = [
    'v_kpi_today', 'mv_inbox_b2b_hot', 'mv_inbox_people_hot',
    'mv_inbox_event_review', 'mv_inbox_extract_people',
  ]

  for (const t of [...tables, ...views]) {
    try {
      const { data } = await sb.from(t).select('*').limit(1)
      if (data && data.length > 0) {
        sources[t] = Object.keys(data[0])
      } else {
        sources[t] = []
      }
    } catch {
      sources[t] = ['[error]']
    }
  }

  return sources
}
