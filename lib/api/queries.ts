import { createAdminClient } from '../supabase/server'
import { type NormalisedLead, type NormalisedRun, normaliseLead, normaliseRun } from '../field-resolver'

export type InboxTab = 'queue' | 'inbox'

type Json = Record<string, unknown>
const FEYA_SCHEMA = 'feya_sales'

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

async function getWorkspace(filters: Record<string, unknown> = {}): Promise<Json> {
  const sb = createAdminClient()
  const { data, error } = await sb.rpc('feya_launch_workspace_snapshot', {
    p_limit: Number(filters.limit ?? 50),
    p_channel: String(filters.channel ?? 'reddit'),
    p_avatar_code: filters.avatar_code ?? null,
    p_offer_family_code: filters.offer_family_code ?? null,
  })
  if (error) {
    console.error('[getWorkspace]', error.message)
    return {}
  }
  return asObj(data)
}

export async function getWorkspaceSnapshot(filters: Record<string, unknown> = {}): Promise<Json> {
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

function pickLeadTitle(row: Json): string {
  return str(row.business_name || row.title || row.username || row.url || row.source_url || 'Лид FEYA')
}

function mapQueueRow(row: Json): NormalisedLead {
  return withLeadShape(row, {
    id: str(row.lead_id || row.id),
    title: pickLeadTitle(row),
    url: str(row.url || row.source_url || row.business_website || ''),
    source: str(row.source || row.source_slug || ''),
    source_slug: str(row.source_slug || row.source || ''),
    country: str(row.geo || row.country || ''),
    status: str(row.queue_row_state_ru || row.operator_status_ru || row.lead_status || ''),
    created_at: str(row.lead_created_at || row.detected_at || row.created_at || ''),
    snippet: str(row.snippet || row.latest_summary || row.contact_path || ''),
    score: num(row.lead_score, NaN),
    warmth: str(row.warmth || row.latest_sentiment || ''),
  })
}

function mapRouteRow(row: Json): NormalisedLead {
  return withLeadShape(row, {
    id: str(row.lead_id || row.id),
    title: pickLeadTitle(row),
    url: str(row.url || row.source_url || row.business_website || ''),
    source: str(row.source || row.source_slug || row.channel_mode || ''),
    source_slug: str(row.source_slug || row.source || row.channel_mode || ''),
    status: str(row.operator_status_ru || row.binding_title_ru || row.status || ''),
    created_at: str(row.created_at || row.lead_created_at || ''),
    snippet: str(row.binding_description_ru || row.card_description_ru || row.desired_response || ''),
  })
}

function filterRows(
  rows: NormalisedLead[],
  opts: {
    search?: string
    source?: string
    country?: string
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
    next = next.filter(
      (r) =>
        lower(r.title).includes(q) ||
        lower(r.url).includes(q) ||
        lower(r.snippet).includes(q) ||
        lower(r.username).includes(q) ||
        lower(r.business_name).includes(q) ||
        lower(r.scenario_cluster_name).includes(q),
    )
    filtersApplied.push(`search:${opts.search}`)
  }

  if (opts.status) {
    const q = opts.status.toLowerCase()
    next = next.filter(
      (r) =>
        lower(r.status).includes(q) ||
        lower(r.operator_status_ru).includes(q) ||
        lower(r.queue_row_state_ru).includes(q) ||
        lower(r.reply_state_ru).includes(q),
    )
    filtersApplied.push(`status:${opts.status}`)
  }

  if (opts.country) {
    const q = opts.country.toLowerCase()
    next = next.filter((r) => lower(r.country).includes(q))
    filtersApplied.push(`country:${opts.country}`)
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
    search?: string
    source?: string
    country?: string
    status?: string
  } = {},
): Promise<{ rows: NormalisedLead[]; _debug: InboxDebug }> {
  const sb = createAdminClient()
  const limit = opts.limit ?? 150

  if (tab === 'queue') {
    const { data, error } = await sb
      .schema(FEYA_SCHEMA)
      .from('ops_queue_list_layer_view')
      .select('*')
      .order('lead_created_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error) {
      console.error('[getInbox:queue]', error.message)
      return {
        rows: [],
        _debug: {
          view: 'feya_sales.ops_queue_list_layer_view',
          filtersApplied: [error.message],
          orderUsed: 'lead_created_at desc',
        },
      }
    }

    const rows = asArr<Json>(data).map(mapQueueRow)
    const filtered = filterRows(rows, opts)
    return {
      rows: filtered.rows,
      _debug: {
        view: 'feya_sales.ops_queue_list_layer_view',
        filtersApplied: filtered.filtersApplied,
        orderUsed: 'lead_created_at desc',
      },
    }
  }

  const { data, error } = await sb.schema(FEYA_SCHEMA).from('ops_inbox_frontend_view').select('*').limit(limit)

  if (error) {
    console.error('[getInbox:inbox]', error.message)
    return {
      rows: [],
      _debug: {
        view: 'feya_sales.ops_inbox_frontend_view',
        filtersApplied: [error.message],
        orderUsed: 'default',
      },
    }
  }

  const rows = asArr<Json>(data).map(mapRouteRow)
  const filtered = filterRows(rows, opts)
  return {
    rows: filtered.rows,
    _debug: {
      view: 'feya_sales.ops_inbox_frontend_view',
      filtersApplied: filtered.filtersApplied,
      orderUsed: 'default',
    },
  }
}

export async function getWorkspaceDetail(
  leadId: string,
  routeCode: InboxTab = 'queue',
): Promise<{ row: NormalisedLead | null; _debug: InboxDebug }> {
  const sb = createAdminClient()

  const workspacePromise = sb
    .schema(FEYA_SCHEMA)
    .from('ops_frontend_scenario_workspace_view')
    .select('*')
    .eq('lead_id', leadId)
    .limit(1)
    .maybeSingle()

  const routeView = routeCode === 'inbox' ? 'ops_inbox_frontend_view' : 'ops_queue_frontend_view'
  const routePromise = sb.schema(FEYA_SCHEMA).from(routeView).select('*').eq('lead_id', leadId).limit(1).maybeSingle()

  const [{ data: workspaceData, error: workspaceError }, { data: routeData, error: routeError }] = await Promise.all([
    workspacePromise,
    routePromise,
  ])

  if (workspaceError && routeError) {
    const message = [workspaceError.message, routeError.message].filter(Boolean).join(' | ')
    return {
      row: null,
      _debug: {
        view: `feya_sales.ops_frontend_scenario_workspace_view + feya_sales.${routeView}`,
        filtersApplied: [message],
        orderUsed: 'lead_id exact',
      },
    }
  }

  const merged = {
    ...asObj(routeData),
    ...asObj(workspaceData),
  }

  return {
    row: Object.keys(merged).length > 0 ? mapRouteRow(merged) : null,
    _debug: {
      view: `feya_sales.ops_frontend_scenario_workspace_view + feya_sales.${routeView}`,
      filtersApplied: [],
      orderUsed: 'lead_id exact',
    },
  }
}

export async function getRunsRecent(limit = 200): Promise<NormalisedRun[]> {
  const sb = createAdminClient()
  const { data, error } = await sb.from('runs').select('*').order('created_at', { ascending: false }).limit(limit)
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
  const { data } = await sb.from('runs').select('*').in('status', ['error', 'failed']).order('created_at', { ascending: false }).limit(limit)
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

export async function getLeadAnalyticsRollup(_days?: number, _dateFrom?: string, _dateTo?: string) {
  return []
}

export async function getLeadAnalyticsRollup2(_days?: number, _dateFrom?: string, _dateTo?: string) {
  return []
}

export async function getKpiTodayCounts() {
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  return [
    {
      leads_count: num(s.already_live_ready_total),
      send_ready_total: num(s.send_ready_total),
      approval_bootstrap_candidate_total: num(s.approval_bootstrap_candidate_total),
      guarded_live_apply_candidate_total: num(s.guarded_live_apply_candidate_total),
      reply_rows_total: num(s.reply_rows_total),
      source_rows_total: num(s.source_rows_total),
    },
  ]
}

export async function getLeadExplainRu(leadId: string) {
  return {
    lead_id: leadId,
    ru_summary:
      'FEYA-native explanation layer для нового ядра ещё не пересобран полностью. На этом шаге используется базовое пояснение из карточки и raw snapshot fields.',
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

export async function getSourceFunnelDaily(_days?: number, _dateFrom?: string, _dateTo?: string) {
  const ws = await getWorkspace({ limit: 50 })
  const s = asObj(ws.executive_summary)
  const day = new Date().toISOString().slice(5, 10)
  return [
    { day, source_slug: 'approval_wave', leads_captured: num(s.next_approval_wave_total), approved: 0, shortlisted: 0, rejected: 0, qualified: 0, contacted: 0, replied: 0, meeting: 0, proposal: 0, won: 0, lost: 0 },
    { day, source_slug: 'live_ready', leads_captured: num(s.already_live_ready_total), approved: num(s.send_ready_total), shortlisted: 0, rejected: 0, qualified: 0, contacted: 0, replied: 0, meeting: 0, proposal: 0, won: 0, lost: 0 },
    { day, source_slug: 'reply_intake', leads_captured: num(s.reply_rows_total), approved: 0, shortlisted: 0, rejected: 0, qualified: 0, contacted: 0, replied: num(s.reply_rows_total), meeting: 0, proposal: 0, won: 0, lost: 0 },
  ]
}

export async function getFunnelBySourceEntity(_days?: number) {
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
