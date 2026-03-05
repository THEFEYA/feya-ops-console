import { createAdminClient } from '../supabase/server'
import { NormalisedLead, NormalisedRun, normaliseLead, normaliseRun } from '../field-resolver'

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
    .select('status, node, created_at')
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
  const { data: outcomes } = await sb.from('lead_outcomes').select('outcome, created_at').limit(5000)
  return { leads, outcomes: outcomes ?? [] }
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
