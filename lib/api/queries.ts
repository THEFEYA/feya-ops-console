import { createAdminClient } from '../supabase/server'
import { NormalisedLead, NormalisedRun, normaliseLead, normaliseRun } from '../field-resolver'
import { getFunctionLabel, getStatusLabelRu, getStatusVariant, normalizeErrorRu } from '../domain/functionRegistry'

export type InboxTab = 'b2b_hot' | 'people_hot' | 'event_review' | 'extract_people'

const INBOX_VIEW_MAP: Record<InboxTab, string> = {
  b2b_hot: 'inbox_b2b_hot_enriched',
  people_hot: 'inbox_people_hot_enriched',
  event_review: 'inbox_event_review_enriched',
  extract_people: 'inbox_extract_people_enriched',
}

export async function getKpiToday() {
  const sb = createAdminClient()
  const { data, error } = await sb.from('v_kpi_today').select('*').limit(1).maybeSingle()
  if (error) console.error('[getKpiToday]', error.message)
  return data ?? {}
}

export interface InboxDebug {
  view: string
  filtersApplied: string[]
  orderUsed: string
}

export async function getInbox(
  tab: InboxTab,
  opts: {
    limit?: number
    scoreMin?: number
    scoreMax?: number
    warmth?: string
    source?: string
    country?: string
    search?: string
    status?: string
  } = {}
): Promise<{ rows: NormalisedLead[]; _debug: InboxDebug }> {
  const sb = createAdminClient()
  const view = INBOX_VIEW_MAP[tab]
  const limit = opts.limit ?? 200

  // Only source and search are applied server-side; warmth/status/score are done client-side
  // to avoid zeroing out results when columns differ between views
  const filtersApplied: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function withFilters(q: any) {
    if (opts.source) { q = q.ilike('source_slug', `%${opts.source}%`); if (!filtersApplied.includes(`source:${opts.source}`)) filtersApplied.push(`source:${opts.source}`) }
    if (opts.search) { q = q.or(`title.ilike.%${opts.search}%,url.ilike.%${opts.search}%`); if (!filtersApplied.includes(`search:${opts.search}`)) filtersApplied.push(`search:${opts.search}`) }
    return q
  }

  // Tier 1: order by created_at
  let orderUsed = 'created_at'
  let { data, error } = await withFilters(
    sb.from(view).select('*').order('created_at', { ascending: false }).limit(limit)
  )

  // Tier 2: created_at missing — try task_created_at
  if (error?.message.includes('created_at') && error.message.includes('does not exist')) {
    orderUsed = 'task_created_at'
    ;({ data, error } = await withFilters(
      sb.from(view).select('*').order('task_created_at', { ascending: false }).limit(limit)
    ))
  }

  // Tier 3: task_created_at missing too — no ordering
  if (error?.message.includes('task_created_at') && error.message.includes('does not exist')) {
    orderUsed = 'none'
    ;({ data, error } = await withFilters(sb.from(view).select('*').limit(limit)))
  }

  if (error) console.error(`[getInbox:${tab}]`, error.message)

  return {
    rows: (data ?? []).map(normaliseLead),
    _debug: { view, filtersApplied, orderUsed },
  }
}

export async function getRunsRecent(limit = 200): Promise<NormalisedRun[]> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) console.error('[getRunsRecent]', error.message)
  return (data ?? []).map(normaliseRun)
}

export async function getTasksStats() {
  const sb = createAdminClient()
  const { data, error } = await sb.from('tasks').select('status').limit(2000)
  if (error) console.error('[getTasksStats]', error.message)
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
  // Try tasks first, then runs
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
  // Aggregate tasks by pipeline stage/node
  const { data, error } = await sb
    .from('tasks')
    .select('status, created_at')
    .limit(5000)
  if (error) console.error('[getPipelineNodeStats]', error.message)
  return data ?? []
}

export async function getLeadAnalyticsRollup(days = 90, dateFrom?: string, dateTo?: string) {
  const sb = createAdminClient()
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  // Try with date filter; fall back to unfiltered if 'day' column missing
  let { data, error } = dateFrom && dateTo
    ? await sb.from('lead_analytics_rollup').select('*')
        .gte('day', dateFrom).lte('day', dateTo)
        .order('day', { ascending: false }).limit(5000)
    : await sb.from('lead_analytics_rollup').select('*')
        .gte('day', cutoff)
        .order('day', { ascending: false }).limit(5000)
  if (error?.message.includes('day') && error.message.includes('does not exist')) {
    ;({ data, error } = await sb.from('lead_analytics_rollup').select('*').limit(5000))
  }
  if (error) console.error('[getLeadAnalyticsRollup]', error.message)
  return data ?? []
}

export async function getSourceFunnelDaily(days = 30, dateFrom?: string, dateTo?: string) {
  const sb = createAdminClient()
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  let q = sb.from('v_source_funnel_daily').select('*')
  if (dateFrom && dateTo) {
    q = q.gte('day', dateFrom).lte('day', dateTo)
  } else {
    q = q.gte('day', cutoff)
  }
  const { data, error } = await q.order('day', { ascending: false }).limit(10000)
  if (error) console.error('[getSourceFunnelDaily]', error.message)
  return data ?? []
}

export async function getFunnelBySourceEntity(days = 30) {
  const sb = createAdminClient()
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  // Some deployments may not have a 'day' column — fall back to unfiltered
  let { data, error } = await sb
    .from('v_funnel_by_source_entity')
    .select('*')
    .gte('day', cutoff)
    .limit(1000)
  if (error?.message.includes('day') && error.message.includes('does not exist')) {
    ;({ data, error } = await sb.from('v_funnel_by_source_entity').select('*').limit(1000))
  }
  if (error) console.error('[getFunnelBySourceEntity]', error.message)
  return data ?? []
}

export async function getKpiTodayCounts() {
  const sb = createAdminClient()
  const { data, error } = await sb.from('kpi_today_counts').select('*').limit(1).maybeSingle()
  if (error) console.error('[getKpiTodayCounts]', error.message)
  return data ?? {}
}

export async function getLeadExplainRu(leadId: string) {
  if (!leadId) return null
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('lead_explain_ru')
    .select('lead_id, ru_summary, ru_explain')
    .eq('lead_id', leadId)
    .limit(1)
    .maybeSingle()
  if (error) console.error('[getLeadExplainRu]', error.message)
  return data ?? null
}

export async function getUiTermsRu() {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('ui_terms_ru_v')
    .select('term, ru, kind')
    .limit(2000)
  if (error) console.error('[getUiTermsRu]', error.message)
  return data ?? []
}

export async function getLeadAnalytics() {
  const sb = createAdminClient()
  // Read directly from leads table — no dependency on 'id' column.
  // Tier 1: extended select with lead_id as PK candidate
  let leads: Record<string, unknown>[] = []
  const { data: t1, error: e1 } = await sb
    .from('leads')
    .select('lead_id, created_at, source_slug, source, warmth, country, score, outcome, status')
    .limit(5000)
  if (!e1) {
    leads = (t1 ?? []) as Record<string, unknown>[]
  } else {
    // Tier 2: drop optional columns; still try created_at
    const { data: t2, error: e2 } = await sb
      .from('leads')
      .select('created_at, source_slug, source, warmth, country, score')
      .limit(5000)
    if (!e2) {
      leads = (t2 ?? []) as Record<string, unknown>[]
    } else {
      // Tier 3: created_at may not exist — try inserted_at instead
      const { data: t3 } = await sb
        .from('leads')
        .select('inserted_at, source_slug, source, warmth, country, score')
        .limit(5000)
      leads = (t3 ?? []) as Record<string, unknown>[]
    }
  }
  const { data: outcomes } = await sb.from('lead_outcomes').select('stage, created_at').limit(5000)
  return { leads, outcomes: outcomes ?? [] }
}

export async function getLeadAnalyticsRollup2(days = 90, dateFrom?: string, dateTo?: string) {
  const sb = createAdminClient()
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

  // Try rollup2 first (has lead_kind column), fall back to rollup
  const buildQuery = (table: string) => {
    const q = dateFrom && dateTo
      ? sb.from(table).select('*').gte('day', dateFrom).lte('day', dateTo).order('day', { ascending: false }).limit(5000)
      : sb.from(table).select('*').gte('day', cutoff).order('day', { ascending: false }).limit(5000)
    return q
  }

  let { data, error } = await buildQuery('lead_analytics_rollup2')
  if (error) {
    // fallback to rollup
    ;({ data, error } = await buildQuery('lead_analytics_rollup'))
    if (error?.message.includes('day') && error.message.includes('does not exist')) {
      ;({ data, error } = await sb.from('lead_analytics_rollup').select('*').limit(5000))
    }
    if (error?.message.includes('lead_analytics_rollup')) {
      ;({ data, error } = await sb.from('lead_analytics_rollup2').select('*').limit(5000))
    }
  }
  if (error) console.error('[getLeadAnalyticsRollup2]', error.message)
  return data ?? []
}

/** Raw stage transitions per lead: from_stage, to_stage, hours_elapsed, source_slug */
export async function getStageTransitions() {
  const sb = createAdminClient()
  const { data, error } = await sb.from('v_stage_transitions').select('*').limit(20000)
  if (error) console.error('[getStageTransitions]', error.message)
  return data ?? []
}

/** Latest stage per lead (current_stage = last event by created_at) */
export async function getLeadCurrentStage() {
  const sb = createAdminClient()
  const { data, error } = await sb.from('v_lead_current_stage').select('*').limit(10000)
  if (error) console.error('[getLeadCurrentStage]', error.message)
  return data ?? []
}

/** Max-ever stage per lead (ever_stage = highest stage order reached) + rollback_count */
export async function getLeadEverStage() {
  const sb = createAdminClient()
  const { data, error } = await sb.from('v_lead_ever_stage').select('*').limit(10000)
  if (error) console.error('[getLeadEverStage]', error.message)
  return data ?? []
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

// ─── Unified run history ───────────────────────────────────────────────────────

/**
 * A normalised run row combining all 4 run tables:
 *   runs (SERP), extract_runs, b2b_place_runs, lm_tg_runs.
 */
export interface RunUnified {
  id:              string
  functionId:      string
  functionLabelRu: string
  status:          string | null
  statusRu:        string
  statusVariant:   'ok' | 'error' | 'running' | 'warn' | 'idle'
  created_at:      string | null
  error_text:      string | null
  errorRu:         string | null
  /** Inputs processed (results_found / people_found / found) */
  count_in:        number | null
  /** Outputs created  (leads_created / people_upserted / upserted / sent_count) */
  count_out:       number | null
  /** Human-readable source identifier: source_slug or extractor name */
  source_label:    string | null
  /** Which DB table this row came from */
  source_table:    'runs' | 'extract_runs' | 'b2b_place_runs' | 'lm_tg_runs'
}

/**
 * Fetch recent runs from all 4 run tables, normalised and sorted newest-first.
 * Joins `runs` with `sources` so SERP/Reddit entries get readable names.
 */
export async function getRunsUnified(limit = 200): Promise<RunUnified[]> {
  const sb = createAdminClient()

  const [runsRes, extractRes, placesRes, digestRes] = await Promise.all([
    sb.from('runs')
      .select('run_id, source_id, status, created_at, error_text, results_found, leads_created')
      .order('created_at', { ascending: false })
      .limit(200),
    sb.from('extract_runs')
      .select('extract_run_id, extractor, people_found, people_upserted, created_at, errors')
      .order('created_at', { ascending: false })
      .limit(100),
    sb.from('b2b_place_runs')
      .select('place_run_id, status, found, upserted, started_at, error_text')
      .order('started_at', { ascending: false })
      .limit(100),
    sb.from('lm_tg_runs')
      .select('run_id, status, found_count, sent_count, started_at, error_text, mode')
      .order('started_at', { ascending: false })
      .limit(50),
  ])

  // Resolve source_slug for runs rows
  const sourceIds = [...new Set(
    (runsRes.data ?? []).map((r: Record<string, string>) => r.source_id).filter(Boolean)
  )]
  const slugMap: Record<string, string> = {}
  const nameMap: Record<string, string> = {}
  if (sourceIds.length > 0) {
    const { data: sources } = await sb
      .from('sources')
      .select('source_id, source_slug, source_name')
      .in('source_id', sourceIds.slice(0, 300))
    for (const s of sources ?? []) {
      const raw = s as Record<string, string>
      slugMap[raw.source_id] = raw.source_slug ?? ''
      nameMap[raw.source_id] = raw.source_name ?? ''
    }
  }

  const unified: RunUnified[] = []

  // SERP / Reddit collector runs
  for (const r of (runsRes.data ?? []) as Record<string, unknown>[]) {
    const slug = slugMap[String(r.source_id)] ?? ''
    const srcName = nameMap[String(r.source_id)] ?? ''
    const funcId = slug.toLowerCase().includes('reddit')
      ? 'collector_reddit_rss'
      : 'collector_serp_serper'
    const status = String(r.status ?? '')
    unified.push({
      id:              String(r.run_id),
      functionId:      funcId,
      functionLabelRu: getFunctionLabel(funcId),
      status:          status || null,
      statusRu:        getStatusLabelRu(status),
      statusVariant:   getStatusVariant(status),
      created_at:      String(r.created_at ?? ''),
      error_text:      String(r.error_text ?? '') || null,
      errorRu:         normalizeErrorRu(String(r.error_text ?? '') || null),
      count_in:        typeof r.results_found === 'number' ? r.results_found : null,
      count_out:       typeof r.leads_created === 'number' ? r.leads_created : null,
      source_label:    srcName || slug || null,
      source_table:    'runs',
    })
  }

  // Extract people runs
  for (const r of (extractRes.data ?? []) as Record<string, unknown>[]) {
    const extractor = String(r.extractor ?? '')
    const errText = r.errors
      ? (() => { try { return JSON.stringify(r.errors).slice(0, 200) } catch { return null } })()
      : null
    unified.push({
      id:              String(r.extract_run_id),
      functionId:      extractor,
      functionLabelRu: getFunctionLabel(extractor),
      status:          'done',
      statusRu:        getStatusLabelRu('done'),
      statusVariant:   getStatusVariant('done'),
      created_at:      String(r.created_at ?? ''),
      error_text:      errText,
      errorRu:         normalizeErrorRu(errText),
      count_in:        typeof r.people_found    === 'number' ? r.people_found    : null,
      count_out:       typeof r.people_upserted === 'number' ? r.people_upserted : null,
      source_label:    getFunctionLabel(extractor),
      source_table:    'extract_runs',
    })
  }

  // Google Places / B2B place runs
  for (const r of (placesRes.data ?? []) as Record<string, unknown>[]) {
    const status = String(r.status ?? '')
    unified.push({
      id:              String(r.place_run_id),
      functionId:      'collector_google_places',
      functionLabelRu: getFunctionLabel('collector_google_places'),
      status:          status || null,
      statusRu:        getStatusLabelRu(status),
      statusVariant:   getStatusVariant(status),
      created_at:      String(r.started_at ?? ''),
      error_text:      String(r.error_text ?? '') || null,
      errorRu:         normalizeErrorRu(String(r.error_text ?? '') || null),
      count_in:        typeof r.found    === 'number' ? r.found    : null,
      count_out:       typeof r.upserted === 'number' ? r.upserted : null,
      source_label:    'Google Places',
      source_table:    'b2b_place_runs',
    })
  }

  // Telegram / digest runs
  for (const r of (digestRes.data ?? []) as Record<string, unknown>[]) {
    const status = String(r.status ?? '')
    const mode   = String(r.mode ?? '')
    unified.push({
      id:              String(r.run_id),
      functionId:      'digest_email_daily',
      functionLabelRu: mode ? `Дайджест (${mode})` : getFunctionLabel('digest_email_daily'),
      status:          status || null,
      statusRu:        getStatusLabelRu(status),
      statusVariant:   getStatusVariant(status),
      created_at:      String(r.started_at ?? ''),
      error_text:      String(r.error_text ?? '') || null,
      errorRu:         normalizeErrorRu(String(r.error_text ?? '') || null),
      count_in:        typeof r.found_count === 'number' ? r.found_count : null,
      count_out:       typeof r.sent_count  === 'number' ? r.sent_count  : null,
      source_label:    'Telegram / Email',
      source_table:    'lm_tg_runs',
    })
  }

  return unified
    .filter((r) => r.created_at && r.created_at !== 'undefined')
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
    .slice(0, limit)
}

// ─── Per-function system status ────────────────────────────────────────────────

export interface FunctionHealth {
  functionId:      string
  functionLabelRu: string
  groupRu:         string
  lastRunAt:       string | null
  lastStatus:      string | null
  lastStatusRu:    string
  statusVariant:   'ok' | 'error' | 'running' | 'warn' | 'idle'
  errors24h:       number
  lastError:       string | null
  lastCountIn:     number | null
  lastCountOut:    number | null
}

export interface SystemStatus {
  functions:    FunctionHealth[]
  summary: {
    ok:          number
    attention:   number
    errors24h:   number
    lastActivityAt: string | null
  }
}

/**
 * Derive per-function health from the unified run history.
 * Called once per page load / refresh.
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const runs = await getRunsUnified(500)

  const now = Date.now()
  const cutoff24h = now - 24 * 3600 * 1000

  // Group by functionId
  const groups: Record<string, RunUnified[]> = {}
  for (const r of runs) {
    if (!groups[r.functionId]) groups[r.functionId] = []
    groups[r.functionId].push(r)
  }

  // Build per-function health
  const functions: FunctionHealth[] = []
  for (const [funcId, group] of Object.entries(groups)) {
    const latest = group[0]  // already sorted newest-first
    const errors24h = group.filter((r) => {
      const ts = r.created_at ? new Date(r.created_at).getTime() : 0
      return ts > cutoff24h && (r.statusVariant === 'error')
    }).length

    // Determine group label from registry
    const { FUNCTION_REGISTRY } = await import('../domain/functionRegistry')
    const meta = FUNCTION_REGISTRY[funcId as keyof typeof FUNCTION_REGISTRY]
    const groupRu = meta?.groupRu ?? 'Прочее'

    functions.push({
      functionId:      funcId,
      functionLabelRu: latest.functionLabelRu,
      groupRu,
      lastRunAt:       latest.created_at,
      lastStatus:      latest.status,
      lastStatusRu:    latest.statusRu,
      statusVariant:   latest.statusVariant,
      errors24h,
      lastError:       latest.errorRu ?? latest.error_text,
      lastCountIn:     latest.count_in,
      lastCountOut:    latest.count_out,
    })
  }

  // Sort: errors first, then by last run time
  functions.sort((a, b) => {
    const aScore = a.statusVariant === 'error' ? 0 : a.statusVariant === 'warn' ? 1 : 2
    const bScore = b.statusVariant === 'error' ? 0 : b.statusVariant === 'warn' ? 1 : 2
    if (aScore !== bScore) return aScore - bScore
    return new Date(b.lastRunAt ?? 0).getTime() - new Date(a.lastRunAt ?? 0).getTime()
  })

  const ok        = functions.filter((f) => f.statusVariant === 'ok').length
  const attention = functions.filter((f) => f.statusVariant === 'error' || f.statusVariant === 'warn').length
  const errors24h = functions.reduce((sum, f) => sum + f.errors24h, 0)

  const timestamps = runs
    .map((r) => r.created_at ? new Date(r.created_at).getTime() : 0)
    .filter((t) => t > 0)
  const lastActivityAt = timestamps.length
    ? new Date(Math.max(...timestamps)).toISOString()
    : null

  return { functions, summary: { ok, attention, errors24h, lastActivityAt } }
}
