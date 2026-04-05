import { createAdminClient } from '../supabase/server'
import { type NormalisedLead, type NormalisedRun, normaliseLead, normaliseRun } from '../field-resolver'

export type InboxTab = 'b2b_hot' | 'people_hot' | 'event_review' | 'extract_people'
type Json = Record<string, unknown>

type WorkspaceFilters = {
  limit?: number
  channel?: string | null
  avatar_code?: string | null
  offer_family_code?: string | null
}

function asObj(v: unknown): Json {
  return v && typeof v === 'object' ? (v as Json) : {}
}

function asArr<T = Json>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

async function getWorkspace(filters: WorkspaceFilters = {}) {
  const sb = createAdminClient()
  const { data, error } = await sb.rpc('feya_launch_workspace_snapshot', {
    p_limit: filters.limit ?? 50,
    p_channel: filters.channel ?? 'reddit',
    p_avatar_code: filters.avatar_code ?? null,
    p_offer_family_code: filters.offer_family_code ?? null,
  })
  if (error) {
    console.error('[getWorkspace]', error.message)
    return {} as Json
  }
  return asObj(data)
}

function patchLead(row: Json, overrides: Partial<NormalisedLead> = {}): NormalisedLead {
  return {
    ...normaliseLead(row),
    ...overrides,
    _raw: row,
  }
}

export async function getKpiToday() {
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  return {
    leads_today: Number(s.source_rows_total ?? 0),
    tasks_open: Number(s.approval_bootstrap_candidate_total ?? 0) + Number(s.guarded_live_apply_candidate_total ?? 0),
    errors_24h: 0,
    last_run_at: ws.generated_at ?? null,
    send_ready_total: Number(s.send_ready_total ?? 0),
    already_live_ready_total: Number(s.already_live_ready_total ?? 0),
    next_approval_wave_total: Number(s.next_approval_wave_total ?? 0),
  }
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
  const ws = await getWorkspace({ limit: opts.limit ?? 200 })
  const filtersApplied: string[] = []

  let rawRows: Json[] = []
  let view = ''

  if (tab === 'b2b_hot') {
    view = 'feya_launch_workspace_snapshot.source_intake.rows'
    rawRows = asArr<Json>(asObj(ws.source_intake).rows)
  } else if (tab === 'people_hot') {
    view = 'feya_launch_workspace_snapshot.reply_intake.rows'
    rawRows = asArr<Json>(asObj(ws.reply_intake).rows)
  } else if (tab === 'event_review') {
    view = 'feya_launch_workspace_snapshot.next_approval_wave.rows'
    rawRows = asArr<Json>(asObj(ws.next_approval_wave).rows)
  } else {
    view = 'feya_launch_workspace_snapshot.decision_command.commands'
    rawRows = asArr<Json>(asObj(ws.decision_command).commands)
  }

  let rows = rawRows.map((row) => {
    if (tab === 'event_review') {
      return patchLead(row, {
        id: String(row.target_queue_id ?? row.lead_id ?? ''),
        title: String(row.username ?? row.title ?? row.target_queue_id ?? '—'),
        source: String(row.conversation_channel ?? row.source_slug ?? 'reddit'),
        source_slug: String(row.conversation_channel ?? row.source_slug ?? 'reddit'),
        status: String(row.approval_bootstrap_status ?? row.rollout_policy_status ?? ''),
      })
    }
    if (tab === 'extract_people') {
      return patchLead(row, {
        id: String(row.target_queue_id ?? row.lead_id ?? ''),
        title: String(row.username ?? row.command_code ?? row.target_queue_id ?? '—'),
        source: String(row.source_slug ?? row.channel ?? 'reddit'),
        source_slug: String(row.source_slug ?? row.channel ?? 'reddit'),
        status: String(row.command_mode ?? row.decision_code ?? ''),
      })
    }
    return patchLead(row)
  })

  if (opts.source) {
    const q = opts.source.toLowerCase()
    rows = rows.filter((r) => String(r.source_slug ?? '').toLowerCase().includes(q))
    filtersApplied.push(`source:${opts.source}`)
  }
  if (opts.search) {
    const q = opts.search.toLowerCase()
    rows = rows.filter((r) =>
      String(r.title ?? '').toLowerCase().includes(q) ||
      String(r.url ?? '').toLowerCase().includes(q) ||
      String(r.snippet ?? '').toLowerCase().includes(q)
    )
    filtersApplied.push(`search:${opts.search}`)
  }
  if (opts.status) {
    const q = opts.status.toLowerCase()
    rows = rows.filter((r) => String(r.status ?? '').toLowerCase().includes(q))
    filtersApplied.push(`status:${opts.status}`)
  }
  if (opts.country) {
    const q = opts.country.toLowerCase()
    rows = rows.filter((r) => String((r as Json).country ?? '').toLowerCase().includes(q))
    filtersApplied.push(`country:${opts.country}`)
  }
  if (opts.scoreMin !== undefined) rows = rows.filter((r) => Number(r.score ?? 0) >= opts.scoreMin!)
  if (opts.scoreMax !== undefined) rows = rows.filter((r) => Number(r.score ?? 0) <= opts.scoreMax!)
  if (opts.warmth) {
    const q = opts.warmth.toLowerCase()
    rows = rows.filter((r) => String(r.warmth ?? '').toLowerCase().includes(q))
  }

  return {
    rows,
    _debug: { view, filtersApplied, orderUsed: 'workspace_snapshot' },
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
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  return {
    open: Number(s.approval_bootstrap_candidate_total ?? 0),
    queued: Number(s.guarded_live_apply_candidate_total ?? 0),
    error: 0,
    failed: 0,
    ready: Number(s.send_ready_total ?? 0),
  }
}

export async function getRecentErrors(limit = 50) {
  const sb = createAdminClient()
  const { data } = await sb
    .from('runs')
    .select('*')
    .in('status', ['error', 'failed'])
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getPipelineNodeStats() {
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  return [
    { name: 'approval', status: 'open', count: Number(s.approval_bootstrap_candidate_total ?? 0), created_at: ws.generated_at },
    { name: 'execution', status: 'queued', count: Number(s.guarded_live_apply_candidate_total ?? 0), created_at: ws.generated_at },
    { name: 'ready', status: 'ok', count: Number(s.send_ready_total ?? 0), created_at: ws.generated_at },
    { name: 'reply_intake', status: 'open', count: Number(s.reply_rows_total ?? 0), created_at: ws.generated_at },
  ]
}

export async function getLeadAnalytics() {
  const ws = await getWorkspace({ limit: 100 })
  return {
    leads: asArr<Json>(asObj(ws.source_intake).rows),
    outcomes: [],
    replies: asArr<Json>(asObj(ws.reply_intake).rows),
    decisions: asArr<Json>(asObj(ws.decision_command).commands),
  }
}

export async function getLeadAnalyticsRollup(days = 90, _dateFrom?: string, _dateTo?: string) {
  const ws = await getWorkspace({ limit: Math.min(200, Math.max(30, days)) })
  const s = asObj(ws.executive_summary)
  const day = String(ws.generated_at ?? '').slice(0, 10)
  return [
    { day, metric: 'send_ready_total', leads_cnt: Number(s.send_ready_total ?? 0) },
    { day, metric: 'approval_bootstrap_candidate_total', leads_cnt: Number(s.approval_bootstrap_candidate_total ?? 0) },
    { day, metric: 'guarded_live_apply_candidate_total', leads_cnt: Number(s.guarded_live_apply_candidate_total ?? 0) },
  ]
}

export async function getLeadAnalyticsRollup2(days = 90, dateFrom?: string, dateTo?: string) {
  return getLeadAnalyticsRollup(days, dateFrom, dateTo)
}

export async function getKpiTodayCounts() {
  return getKpiToday()
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

export async function getSourceFunnelDaily(days = 30, _dateFrom?: string, _dateTo?: string) {
  const ws = await getWorkspace({ limit: Math.min(200, Math.max(30, days)) })
  const sourceRows = asArr<Json>(asObj(ws.source_intake).rows)
  const counts = new Map<string, number>()
  for (const row of sourceRows) {
    const key = String(row.source_slug ?? row.source ?? 'unknown')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const day = String(ws.generated_at ?? '').slice(0, 10)
  return Array.from(counts.entries()).map(([source_slug, leads_captured]) => ({
    day,
    source_slug,
    leads_captured,
    approved: 0,
    shortlisted: 0,
    rejected: 0,
    qualified: 0,
    contacted: 0,
    replied: 0,
    meeting: 0,
    proposal: 0,
    won: 0,
    lost: 0,
  }))
}

export async function getFunnelBySourceEntity(days = 30) {
  return getSourceFunnelDaily(days)
}

export async function getLeadCurrentStage() {
  const ws = await getWorkspace({ limit: 100 })
  return asArr<Json>(asObj(ws.decision_command).commands).map((r) => ({
    lead_id: r.lead_id ?? r.target_queue_id,
    source_slug: r.source_slug ?? r.channel ?? 'reddit',
    current_stage: r.command_mode ?? r.decision_code ?? 'unknown',
  }))
}

export async function getLeadEverStage() {
  return getLeadCurrentStage()
}

export async function getStageTransitions() {
  const ws = await getWorkspace({ limit: 50 })
  return asArr<Json>(asObj(ws.next_action).rows).map((r) => ({
    from_stage: r.current_stage ?? r.current_status ?? 'unknown',
    to_stage: r.next_action_label ?? r.next_status ?? 'unknown',
    hours_elapsed: null,
    source_slug: r.source_slug ?? r.channel ?? 'reddit',
  }))
}

export async function getSchemaKeys() {
  return {
    workspace_rpc: ['public.feya_launch_workspace_snapshot', 'public.feya_next_approval_wave_snapshot', 'public.feya_operator_cockpit_v5_snapshot'],
    execution_tables: ['feya_sales.followup_queue', 'feya_sales.touchpoints', 'feya_sales.approval_logs', 'feya_sales.runtime_execution_actions'],
  }
}
