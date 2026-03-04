import { createAdminClient } from '../supabase/server'
import { NormalisedLead, NormalisedRun, normaliseLead, normaliseRun } from '../field-resolver'

export type InboxTab = 'b2b_hot' | 'people_hot' | 'event_review' | 'extract_people'

const INBOX_VIEW_MAP: Record<InboxTab, string> = {
  b2b_hot: 'mv_inbox_b2b_hot',
  people_hot: 'mv_inbox_people_hot',
  event_review: 'mv_inbox_event_review',
  extract_people: 'mv_inbox_extract_people',
}

export async function getKpiToday() {
  const sb = createAdminClient()
  const { data, error } = await sb.from('v_kpi_today').select('*').limit(1).maybeSingle()
  if (error) console.error('[getKpiToday]', error.message)
  return data ?? {}
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
): Promise<NormalisedLead[]> {
  const sb = createAdminClient()
  const view = INBOX_VIEW_MAP[tab]
  let query = sb.from(view).select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 200)

  // Best-effort filters — only applied if column may exist
  if (opts.warmth) query = query.ilike('warmth', opts.warmth)
  if (opts.source) query = query.ilike('source', `%${opts.source}%`)
  if (opts.country) query = query.ilike('country', `%${opts.country}%`)
  if (opts.status) query = query.eq('status', opts.status)
  if (opts.search) query = query.or(`title.ilike.%${opts.search}%,url.ilike.%${opts.search}%`)
  if (opts.scoreMin != null) query = query.gte('score', opts.scoreMin)
  if (opts.scoreMax != null) query = query.lte('score', opts.scoreMax)

  const { data, error } = await query
  if (error) console.error(`[getInbox:${tab}]`, error.message)
  return (data ?? []).map(normaliseLead)
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

export async function getLeadAnalytics() {
  const sb = createAdminClient()
  // Fetch leads with outcome info for charts
  const { data: leads } = await sb.from('leads').select('source, warmth, country, created_at, score').limit(5000)
  const { data: outcomes } = await sb.from('lead_outcomes').select('outcome, created_at').limit(5000)
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
