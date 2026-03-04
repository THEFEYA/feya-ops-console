/**
 * Defensive field resolver — normalises varying column names
 * across different Supabase tables/views.
 */

type AnyRecord = Record<string, unknown>

/** Pick the first key that exists and has a non-null value */
export function resolveField<T = unknown>(
  row: AnyRecord,
  ...candidates: string[]
): T | undefined {
  for (const key of candidates) {
    if (key in row && row[key] !== null && row[key] !== undefined) {
      return row[key] as T
    }
  }
  return undefined
}

/** Lead shape normalised from various possible column names */
export interface NormalisedLead {
  id: string | number
  title: string
  url: string
  domain?: string
  score?: number
  warmth?: string
  source?: string
  country?: string
  status?: string
  created_at?: string
  snippet?: string
  keyword_used?: string
  query_string?: string
  source_entity?: string
  reach?: number
  event?: string
  // raw row for anything else
  _raw: AnyRecord
}

export function normaliseLead(row: AnyRecord): NormalisedLead {
  const id = resolveField<string | number>(row, 'id', 'lead_id', 'uid') ?? ''
  const title = resolveField<string>(row, 'title', 'name', 'heading', 'subject', 'url') ?? '—'
  const url = resolveField<string>(row, 'url', 'link', 'source_url', 'href') ?? ''
  const domain = resolveField<string>(row, 'domain', 'source_domain', 'host')
  const score = resolveField<number>(row, 'score', 'lead_score', 'intent_score', 'quality_score')
  const warmth = resolveField<string>(row, 'warmth', 'warmth_level', 'intent', 'tier')
  const source = resolveField<string>(row, 'source_slug', 'source', 'source_name', 'channel', 'platform')
  const country = resolveField<string>(row, 'country', 'geo', 'country_code', 'location')
  const status = resolveField<string>(row, 'status', 'state', 'outcome', 'stage')
  const created_at = resolveField<string>(row, 'created_at', 'inserted_at', 'detected_at', 'ts', 'timestamp')
  const snippet = resolveField<string>(row, 'snippet', 'body', 'text', 'content', 'description', 'summary')
  const keyword_used = resolveField<string>(row, 'keyword_used', 'keyword', 'query_keyword', 'kw')
  const query_string = resolveField<string>(row, 'query_string', 'query', 'search_query', 'q')
  const source_entity = resolveField<string>(row, 'source_entity', 'entity', 'actor', 'author', 'subreddit')
  const reach = resolveField<number>(row, 'reach', 'reach_score', 'audience', 'followers')
  const event = resolveField<string>(row, 'event', 'event_name', 'event_type', 'trigger')

  return {
    id,
    title,
    url,
    domain,
    score,
    warmth,
    source,
    country,
    status,
    created_at,
    snippet,
    keyword_used,
    query_string,
    source_entity,
    reach,
    event,
    _raw: row,
  }
}

/** Normalise a run/task record */
export interface NormalisedRun {
  id: string | number
  name?: string
  status?: string
  error?: string
  created_at?: string
  finished_at?: string
  duration_ms?: number
  node?: string
  _raw: AnyRecord
}

export function normaliseRun(row: AnyRecord): NormalisedRun {
  return {
    id: resolveField(row, 'id', 'run_id', 'task_id') ?? '',
    name: resolveField(row, 'name', 'function_name', 'fn', 'type', 'kind'),
    status: resolveField(row, 'status', 'state', 'result'),
    error: resolveField(row, 'error', 'error_message', 'err', 'message'),
    created_at: resolveField(row, 'created_at', 'started_at', 'ts', 'inserted_at'),
    finished_at: resolveField(row, 'finished_at', 'completed_at', 'ended_at'),
    duration_ms: resolveField(row, 'duration_ms', 'latency_ms', 'elapsed_ms'),
    node: resolveField(row, 'node', 'pipeline_node', 'stage', 'component'),
    _raw: row,
  }
}

/** Generate "why is this a lead" heuristics from a NormalisedLead */
const WTB_PATTERNS = /\b(wtb|looking for|want to buy|iso|need|hire|seeking|куплю|ищу|нужен|хочу купить)\b/i
const COMMISSION_PATTERNS = /\b(commiss|% off|agency|broker|partner|партнёр|агент|комисс)\b/i
const CONTACT_PATTERNS = /\b(contact|email|dm|pm|direct|написать|связаться|telegram|whatsapp)\b/i
const B2B_PATTERNS = /\b(company|corp|llc|ltd|gmbh|inc|бизнес|компания|корпорация)\b/i

export function generateLeadReasons(lead: NormalisedLead): string[] {
  const reasons: string[] = []
  const text = [lead.title, lead.snippet, lead.keyword_used, lead.query_string]
    .filter(Boolean)
    .join(' ')

  if (lead.score && lead.score >= 70) reasons.push(`Высокий скоринг: ${lead.score}`)
  if (lead.warmth === 'hot' || lead.warmth === 'горячий') reasons.push('Горячий интент')
  if (WTB_PATTERNS.test(text)) reasons.push('Намерение купить / WTB / ISO')
  if (COMMISSION_PATTERNS.test(text)) reasons.push('Упоминание комиссии или агентства')
  if (CONTACT_PATTERNS.test(text)) reasons.push('Контактный сигнал')
  if (B2B_PATTERNS.test(text)) reasons.push('B2B контекст')
  if (lead.reach && lead.reach > 1000) reasons.push(`Высокий охват: ${lead.reach.toLocaleString()}`)
  if (lead.keyword_used) reasons.push(`Ключевое слово: «${lead.keyword_used}»`)
  if (reasons.length === 0) reasons.push('Совпадение по поисковому запросу')

  return reasons
}
