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

export interface InboxDebug {
  view: string
  filtersApplied: string[]
  orderUsed: string
}

function asObj(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {}
}

function asArr<T = Json>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function lower(value: unknown): string {
  return str(value).toLowerCase()
}

function generatedDay(value: unknown): string {
  return str(value).slice(0, 10) || new Date().toISOString().slice(0, 10)
}

async function getWorkspace(filters: WorkspaceFilters = {}): Promise<Json> {
  const sb = createAdminClient()
  const { data, error } = await sb.rpc('feya_launch_workspace_snapshot', {
    p_limit: filters.limit ?? 50,
    p_channel: filters.channel ?? 'reddit',
    p_avatar_code: filters.avatar_code ?? null,
    p_offer_family_code: filters.offer_family_code ?? null,
  })
  if (error) {
    console.error('[getWorkspace]', error.message)
    return {}
  }
  return asObj(data)
}

function withLeadShape(row: Json, overrides: Partial<NormalisedLead> = {}): NormalisedLead {
  const base = normaliseLead(row)
  return {
    ...base,
    ...overrides,
    _raw: row,
  }
}

function mapApprovalWaveRow(row: Json): NormalisedLead {
  return withLeadShape(row, {
    id: str(row.target_queue_id || row.lead_id || row.conversation_id || row.username),
    title: str(row.title || row.username || row.target_queue_id || '—'),
    url: str(row.url || row.source_url || ''),
    status: str(row.approval_bootstrap_status || row.rollout_policy_status || ''),
    source: str(row.conversation_channel || row.source_slug || 'reddit'),
    source_slug: str(row.conversation_channel || row.source_slug || 'reddit'),
    created_at: str(row.scheduled_for || row.created_at || row.generated_at || ''),
    snippet: str(row.offer_family_name || row.next_policy_code || row.blocked_reason || ''),
    warmth: undefined,
    score: undefined,
    country: undefined,
  })
}

function mapDecisionRow(row: Json): NormalisedLead {
  return withLeadShape(row, {
    id: str(row.target_queue_id || row.lead_id || row.conversation_id || row.username),
    title: str(row.title || row.username || row.command_code || '—'),
    url: str(row.url || row.source_url || ''),
    status: str(row.command_mode || row.decision_code || row.command_code || ''),
    source: str(row.source_slug || row.channel || 'reddit'),
    source_slug: str(row.source_slug || row.channel || 'reddit'),
    created_at: str(row.created_at || row.scheduled_for || ''),
    snippet: str(row.decision_code || row.command_code || ''),
    warmth: undefined,
    score: undefined,
    country: undefined,
  })
}

function filterRows(rows: NormalisedLead[], opts: {
  scoreMin?: number
  scoreMax?: number
  warmth?: string
  source?: string
  country?: string
  search?: string
  status?: string
} = {}): { rows: NormalisedLead[]; filtersApplied: string[] } {
  let next = rows
  const filtersApplied: string[] = []

  if (opts.source) {
    const q = opts.source.toLowerCase()
    next = next.filter((r) => lower(r.source_slug || r.source).includes(q))
    filtersApplied.push(`source:${opts.source}`)
  }

  if (opts.search) {
    const q = opts.search.toLowerCase()
    next = next.filter((r) =>
      lower(r.title).includes(q) ||
      lower(r.url).includes(q) ||
      lower(r.snippet).includes(q) ||
      lower(r.username).includes(q) ||
      lower(r.business_name).includes(q)
    )
    filtersApplied.push(`search:${opts.search}`)
  }

  if (opts.status) {
    const q = opts.status.toLowerCase()
    next = next.filter((r) => lower(r.status).includes(q))
    filtersApplied.push(`status:${opts.status}`)
  }

  if (opts.country) {
    const q = opts.country.toLowerCase()
    next = next.filter((r) => lower(r.country).includes(q))
    filtersApplied.push(`country:${opts.country}`)
  }

  if (opts.warmth) {
    const q = opts.warmth.toLowerCase()
    next = next.filter((r) => lower(r.warmth).includes(q))
    filtersApplied.push(`warmth:${opts.warmth}`)
  }

  if (opts.scoreMin !== undefined) {
    next = next.filter((r) => num(r.score, 0) >= opts.scoreMin!)
    filtersApplied.push(`scoreMin:${opts.scoreMin}`)
  }

  if (opts.scoreMax !== undefined) {
    next = next.filter((r) => num(r.score, 0) <= opts.scoreMax!)
    filtersApplied.push(`scoreMax:${opts.scoreMax}`)
  }

  return { rows: next, filtersApplied }
}

export async function getKpiToday() {
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  return {
    leads_today: num(s.source_rows_total),
    leads_count: num(s.source_rows_total),
    tasks_open: num(s.approval_bootstrap_candidate_total) + num(s.guarded_live_apply_candidate_total),
    errors_24h: 0,
    last_run_at: str(ws.generated_at || null),
    send_ready_total: num(s.send_ready_total),
    already_live_ready_total: num(s.already_live_ready_total),
    next_approval_wave_total: num(s.next_approval_wave_total),
  }
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

  let view = ''
  let rows: NormalisedLead[] = []

  if (tab === 'b2b_hot') {
    view = 'feya_launch_workspace_snapshot.source_intake.rows'
    rows = asArr<Json>(asObj(ws.source_intake).rows).map((row) => withLeadShape(row))
  } else if (tab === 'people_hot') {
    view = 'feya_launch_workspace_snapshot.reply_intake.rows'
    rows = asArr<Json>(asObj(ws.reply_intake).rows).map((row) => withLeadShape(row))
  } else if (tab === 'event_review') {
    view = 'feya_launch_workspace_snapshot.next_approval_wave.rows'
    rows = asArr<Json>(asObj(ws.next_approval_wave).rows).map(mapApprovalWaveRow)
  } else {
    view = 'feya_launch_workspace_snapshot.decision_command.commands'
    rows = asArr<Json>(asObj(ws.decision_command).commands).map(mapDecisionRow)
  }

  const filtered = filterRows(rows, opts)

  return {
    rows: filtered.rows,
    _debug: {
      view,
      filtersApplied: filtered.filtersApplied,
      orderUsed: 'workspace_snapshot',
    },
  }
}

export async function getRunsRecent(limit = 200): Promise<NormalisedRun[]> {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from('runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[getRunsRecent]', error.message)
    return []
  }
  return asArr<Json>(data).map((row) => normaliseRun(row))
}

export async function getTasksStats() {
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  return {
    open: num(s.approval_bootstrap_candidate_total),
    queued: num(s.guarded_live_apply_candidate_total),
    error: 0,
    failed: 0,
    ready: num(s.send_ready_total),
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
  const generated_at = str(ws.generated_at)
  return [
    { id: 'collectors', name: 'source_intake', status: num(s.source_rows_total) > 0 ? 'ok' : 'idle', created_at: generated_at, type: 'collector' },
    { id: 'leads', name: 'approval_queue', status: num(s.approval_bootstrap_candidate_total) > 0 ? 'queued' : 'idle', created_at: generated_at, type: 'lead' },
    { id: 'extractors', name: 'reply_intake', status: num(s.reply_rows_total) > 0 ? 'open' : 'idle', created_at: generated_at, type: 'extractor' },
    { id: 'scoring', name: 'decision_commands', status: num(s.decision_rows_total) > 0 ? 'ok' : 'idle', created_at: generated_at, type: 'signal' },
    { id: 'outreach', name: 'guarded_live_apply', status: num(s.guarded_live_apply_candidate_total) > 0 ? 'queued' : 'idle', created_at: generated_at, type: 'outreach' },
    { id: 'digest', name: 'launch_workspace', status: 'ok', created_at: generated_at, type: 'digest' },
  ]
}

export async function getLeadAnalyticsRollup(days = 90, _dateFrom?: string, _dateTo?: string) {
  const ws = await getWorkspace({ limit: Math.min(200, Math.max(30, days)) })
  const s = asObj(ws.executive_summary)
  const day = generatedDay(ws.generated_at)
  return [
    { day, leads_cnt: num(s.source_rows_total), source_slug: 'workspace', avg_score: 0, avg_intent: 0, avg_reach: 0, max_score: 0 },
    { day, leads_cnt: num(s.reply_rows_total), source_slug: 'reply_intake', avg_score: 0, avg_intent: 0, avg_reach: 0, max_score: 0 },
    { day, leads_cnt: num(s.send_ready_total), source_slug: 'send_ready', avg_score: 0, avg_intent: 0, avg_reach: 0, max_score: 0 },
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

export async function getLeadAnalyticsRollup2(days = 90, dateFrom?: string, dateTo?: string) {
  return getLeadAnalyticsRollup(days, dateFrom, dateTo)
}

export async function getSourceFunnelDaily(days = 30, _dateFrom?: string, _dateTo?: string) {
  const ws = await getWorkspace({ limit: Math.min(200, Math.max(30, days)) })
  const sourceRows = asArr<Json>(asObj(ws.source_intake).rows)
  const bySource = new Map<string, number>()
  for (const row of sourceRows) {
    const key = str(row.source_slug || row.source || 'unknown')
    bySource.set(key, (bySource.get(key) ?? 0) + 1)
  }
  const day = generatedDay(ws.generated_at)
  return Array.from(bySource.entries()).map(([source_slug, leads_captured]) => ({
    day,
    source_slug,
    leads_captured,
    approved: 0,
    shortlisted: 0,
    rejected: 0,
    qualified: leads_captured,
    contacted: 0,
    replied: 0,
    meeting: 0,
    proposal: 0,
    won: 0,
    lost: 0,
    conversion_rate: 0,
  }))
}

export async function getFunnelBySourceEntity(days = 30) {
  return getSourceFunnelDaily(days)
}

export async function getKpiTodayCounts() {
  const kpi = await getKpiToday()
  return {
    ...kpi,
    total: kpi.leads_today ?? 0,
  }
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

export async function getStageTransitions() {
  const ws = await getWorkspace({ limit: 100 })
  return asArr<Json>(asObj(ws.next_action).rows).map((row) => ({
    from_stage: str(row.current_stage || row.current_status || 'unknown'),
    to_stage: str(row.next_action_label || row.next_status || 'unknown'),
    hours_elapsed: null,
    source_slug: str(row.source_slug || row.channel || 'reddit'),
  }))
}

export async function getLeadCurrentStage() {
  const ws = await getWorkspace({ limit: 100 })
  return asArr<Json>(asObj(ws.decision_command).commands).map((row) => ({
    lead_id: str(row.lead_id || row.target_queue_id || row.conversation_id || ''),
    source_slug: str(row.source_slug || row.channel || 'reddit'),
    current_stage: str(row.command_mode || row.decision_code || 'qualified'),
  }))
}

export async function getLeadEverStage() {
  const rows = await getLeadCurrentStage()
  return rows.map((row) => ({
    ...row,
    ever_stage: row.current_stage,
    rollback_count: 0,
  }))
}

export async function getSchemaKeys() {
  return {
    workspace_rpc: [
      'public.feya_launch_workspace_snapshot',
      'public.feya_next_approval_wave_snapshot',
      'public.feya_operator_cockpit_v5_snapshot',
    ],
    execution_tables: [
      'feya_sales.followup_queue',
      'feya_sales.touchpoints',
      'feya_sales.approval_logs',
      'feya_sales.runtime_execution_actions',
    ],
  }
}
