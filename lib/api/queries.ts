 { import { createAdminClient } from '../supabase/server'
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

export async function getWorkspaceSnapshot(filters: WorkspaceFilters = {}): Promise<Json> {
  return getWorkspace(filters)
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
  const title = str(row.username || row.title || row.target_queue_id || 'Approval item')
  return withLeadShape(row, {
    id: str(row.target_queue_id || row.lead_id || row.conversation_id || row.username),
    title: title.startsWith('u/') ? `Reddit user ${title}` : `Reddit user u/${title}`,
    url: str(row.url || row.source_url || ''),
    status: str(row.approval_bootstrap_status || row.rollout_policy_status || ''),
    source: str(row.conversation_channel || row.source_slug || 'reddit'),
    source_slug: str(row.conversation_channel || row.source_slug || 'reddit'),
    created_at: str(row.scheduled_for || row.created_at || row.generated_at || ''),
    snippet: str(row.offer_family_name || row.next_policy_code || row.blocked_reason || row.policy_code || ''),
    warmth: undefined,
    score: undefined,
    country: undefined,
    username: str(row.username || ''),
  })
}

function mapDecisionRow(row: Json): NormalisedLead {
  return withLeadShape(row, {
    id: str(row.target_queue_id || row.lead_id || row.conversation_id || row.username),
    title: str(row.title || row.username || row.command_code || 'Decision item'),
    url: str(row.url || row.source_url || ''),
    status: str(row.command_mode || row.decision_code || row.command_code || ''),
    source: str(row.source_slug || row.channel || 'reddit'),
    source_slug: str(row.source_slug || row.channel || 'reddit'),
    created_at: str(row.created_at || row.scheduled_for || ''),
    snippet: str(row.decision_code || row.command_code || row.policy_code || ''),
    warmth: undefined,
    score: undefined,
    country: undefined,
    username: str(row.username || ''),
  })
}

function mapMessageRow(row: Json): NormalisedLead {
  return withLeadShape(row, {
    id: str(row.target_queue_id || row.touchpoint_id || row.username || row.conversation_id),
    title: str(row.title || row.username || row.offer_family_name || 'Message preview'),
    status: str(row.preview_status || row.policy_code || row.step_number || 'preview'),
    source: str(row.source_slug || row.channel || 'reddit'),
    source_slug: str(row.source_slug || row.channel || 'reddit'),
    created_at: str(row.created_at || row.updated_at || ''),
    snippet: str(row.preview_text || row.approved_text || row.draft_text || ''),
    warmth: undefined,
    score: undefined,
    country: undefined,
    username: str(row.username || ''),
  })
}

function mapReplyRow(row: Json): NormalisedLead {
  return withLeadShape(row, {
    id: str(row.conversation_id || row.lead_id || row.username),
    title: str(row.title || row.username || 'Reply intake'),
    status: str(row.response_class || row.next_action_label || 'reply'),
    source: str(row.source_slug || row.channel || 'reddit'),
    source_slug: str(row.source_slug || row.channel || 'reddit'),
    created_at: str(row.latest_inbound_at || row.created_at || ''),
    snippet: str(row.latest_inbound_text || row.reply_summary || row.snippet || ''),
    warmth: undefined,
    score: undefined,
    country: undefined,
    username: str(row.username || ''),
  })
}

function mapSourceRow(row: Json): NormalisedLead {
  return withLeadShape(row, {
    id: str(row.lead_id || row.signal_id || row.id || row.url || row.username),
    title: str(row.title || row.business_name || row.username || 'Source intake'),
    url: str(row.url || row.source_url || row.business_website || ''),
    status: str(row.status || row.route_policy_code || row.offer_family_code || 'source_signal'),
    source: str(row.source_slug || row.source || 'source'),
    source_slug: str(row.source_slug || row.source || 'source'),
    created_at: str(row.created_at || row.detected_at || row.generated_at || ''),
    snippet: str(row.snippet || row.evidence_text || row.match_terms || ''),
    username: str(row.username || ''),
  })
}

function filterRows(
  rows: NormalisedLead[],
  opts: {
    scoreMin?: number
    scoreMax?: number
    warmth?: string
    source?: string
    country?: string
    search?: string
    status?: string
  } = {},
): { rows: NormalisedLead[]; filtersApplied: string[] } {
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
      lower(r.business_name).includes(q),
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
    next = next.filter((r) => num(r.score, 0) >= opts.scoreMin)
    filtersApplied.push(`scoreMin:${opts.scoreMin}`)
  }

  if (opts.scoreMax !== undefined) {
    next = next.filter((r) => num(r.score, 0) <= opts.scoreMax)
    filtersApplied.push(`scoreMax:${opts.scoreMax}`)
  }

  return { rows: next, filtersApplied }
}

export async function getKpiToday() {
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  return {
    leads_today: num(s.next_approval_wave_total),
    leads_count: num(s.already_live_ready_total),
    tasks_open: num(s.approval_bootstrap_candidate_total) + num(s.guarded_live_apply_candidate_total),
    errors_24h: 0,
    last_run_at: str(ws.generated_at || null),
    send_ready_total: num(s.send_ready_total),
    already_live_ready_total: num(s.already_live_ready_total),
    next_approval_wave_total: num(s.next_approval_wave_total),
    reply_rows_total: num(s.reply_rows_total),
    source_rows_total: num(s.source_rows_total),
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
  } = {},
): Promise<{ rows: NormalisedLead[]; _debug: InboxDebug }> {
  const ws = await getWorkspace({ limit: opts.limit ?? 200 })

  let view = ''
  let rows: NormalisedLead[] = []

  if (tab === 'b2b_hot') {
    view = 'feya_launch_workspace_snapshot.source_intake.rows'
    rows = asArr<Json>(asObj(ws.source_intake).rows).map(mapSourceRow)
  } else if (tab === 'people_hot') {
    view = 'feya_launch_workspace_snapshot.reply_intake.rows'
    rows = asArr<Json>(asObj(ws.reply_intake).rows).map(mapReplyRow)
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
  return [
    { node: 'approval_wave', title: 'Approval Wave', active: num(s.next_approval_wave_total), queued: num(s.approval_bootstrap_candidate_total), errors: 0 },
    { node: 'live_ready', title: 'Live Ready', active: num(s.already_live_ready_total), queued: num(s.send_ready_total), errors: 0 },
    { node: 'guarded_apply', title: 'Guarded Apply', active: num(s.guarded_live_apply_candidate_total), queued: num(s.guarded_live_apply_candidate_total), errors: 0 },
    { node: 'replies', title: 'Replies', active: num(s.reply_rows_total), queued: num(s.reply_rows_total), errors: 0 },
    { node: 'messages', title: 'Message Preview', active: num(s.message_rows_total), queued: num(s.message_rows_total), errors: 0 },
    { node: 'decisions', title: 'Decision Commands', active: num(s.decision_rows_total), queued: num(s.decision_rows_total), errors: 0 },
  ]
}

export async function getLeadAnalytics() {
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  return [
    { metric: 'send_ready_total', value: num(s.send_ready_total) },
    { metric: 'already_live_ready_total', value: num(s.already_live_ready_total) },
    { metric: 'approval_bootstrap_candidate_total', value: num(s.approval_bootstrap_candidate_total) },
    { metric: 'guarded_live_apply_candidate_total', value: num(s.guarded_live_apply_candidate_total) },
    { metric: 'next_approval_wave_total', value: num(s.next_approval_wave_total) },
    { metric: 'reply_rows_total', value: num(s.reply_rows_total) },
  ]
}

export async function getLeadAnalyticsRollup() {
  return []
}

export async function getLeadAnalyticsRollup2() {
  return []
}

export async function getKpiTodayCounts() {
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  return [{
    leads_count: num(s.already_live_ready_total),
    send_ready_total: num(s.send_ready_total),
    approval_bootstrap_candidate_total: num(s.approval_bootstrap_candidate_total),
    guarded_live_apply_candidate_total: num(s.guarded_live_apply_candidate_total),
    reply_rows_total: num(s.reply_rows_total),
    source_rows_total: num(s.source_rows_total),
  }]
}

export async function getLeadExplainRu(leadId: string) {
  return {
    lead_id: leadId,
    ru_summary: 'FEYA-native explanation layer для нового ядра ещё не пересобран полностью. На этом шаге используется базовое пояснение из карточки и raw snapshot fields.',
  }
}

export async function getUiTermsRu() {
  return [
    { term: 'approval_wave', ru: 'Approval Wave' },
    { term: 'decision_queue', ru: 'Команды' },
    { term: 'next_actions', ru: 'Следующие действия' },
    { term: 'message_preview', ru: 'Превью сообщений' },
    { term: 'reply_intake', ru: 'Ответы' },
  ]
}

export async function getSchemaKeys() {
  return []
}

export async function getSourceFunnelDaily() {
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  const day = new Date().toISOString().slice(5, 10)
  return [
    { day, source_slug: 'approval_wave', leads_captured: num(s.next_approval_wave_total), approved: 0, shortlisted: 0, rejected: 0, qualified: 0, contacted: 0, replied: 0, meeting: 0, proposal: 0, won: 0, lost: 0 },
    { day, source_slug: 'live_ready', leads_captured: num(s.already_live_ready_total), approved: num(s.send_ready_total), shortlisted: 0, rejected: 0, qualified: 0, contacted: 0, replied: 0, meeting: 0, proposal: 0, won: 0, lost: 0 },
    { day, source_slug: 'reply_intake', leads_captured: num(s.reply_rows_total), approved: 0, shortlisted: 0, rejected: 0, qualified: 0, contacted: 0, replied: num(s.reply_rows_total), meeting: 0, proposal: 0, won: 0, lost: 0 },
  ]
}

export async function getFunnelBySourceEntity() {
  return []
}

export async function getLeadCurrentStage() {
  return []
}

export async function getLeadEverStage() {
  return []
}

export async function getStageTransitions() {
  return []
}
