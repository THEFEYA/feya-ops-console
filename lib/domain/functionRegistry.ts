/**
 * FEYA — Function Registry
 * Single source of truth mapping internal function identifiers → Russian labels.
 * Used by /flow and /control pages to replace opaque UUIDs / slugs with readable names.
 */

// ─── Registry ─────────────────────────────────────────────────────────────────

export type FunctionId =
  | 'collector_serp_serper'
  | 'collector_reddit_rss'
  | 'extract_people_reddit'
  | 'extract_people_rpf'
  | 'digest_email_daily'
  | 'collector_google_places'
  | 'collector_osm_overpass'

export interface FunctionMeta {
  id: FunctionId
  labelRu:       string
  groupRu:       string
  descriptionRu: string
}

export const FUNCTION_REGISTRY: Record<FunctionId, FunctionMeta> = {
  collector_serp_serper: {
    id:            'collector_serp_serper',
    labelRu:       'SERP сбор (Serper)',
    groupRu:       'Коллекторы',
    descriptionRu: 'Сбор поисковой выдачи через Serper API',
  },
  collector_reddit_rss: {
    id:            'collector_reddit_rss',
    labelRu:       'Reddit RSS сбор',
    groupRu:       'Коллекторы',
    descriptionRu: 'Сбор постов Reddit по RSS-фидам',
  },
  extract_people_reddit: {
    id:            'extract_people_reddit',
    labelRu:       'Извлечение людей: Reddit',
    groupRu:       'Экстракторы',
    descriptionRu: 'Профили из Reddit-постов и комментариев',
  },
  extract_people_rpf: {
    id:            'extract_people_rpf',
    labelRu:       'Извлечение людей: RPF',
    groupRu:       'Экстракторы',
    descriptionRu: 'Профили через RPF-экстрактор',
  },
  digest_email_daily: {
    id:            'digest_email_daily',
    labelRu:       'Дневной дайджест',
    groupRu:       'Дайджест',
    descriptionRu: 'Ежедневный email-дайджест',
  },
  collector_google_places: {
    id:            'collector_google_places',
    labelRu:       'Google Places сбор',
    groupRu:       'Коллекторы',
    descriptionRu: 'Сбор заведений через Google Places API',
  },
  collector_osm_overpass: {
    id:            'collector_osm_overpass',
    labelRu:       'OSM Overpass сбор',
    groupRu:       'Коллекторы',
    descriptionRu: 'Геоданные через OpenStreetMap Overpass API',
  },
}

// ─── Label helpers ─────────────────────────────────────────────────────────────

/**
 * Resolve a Russian label for any identifier — function name, source_slug, extractor, etc.
 * Falls back to pattern matching when no exact entry exists.
 */
export function getFunctionLabel(name: string | null | undefined): string {
  if (!name) return 'Неизвестная функция'
  const n = name.toLowerCase().trim()

  // Direct registry match
  if (n in FUNCTION_REGISTRY) return FUNCTION_REGISTRY[n as FunctionId].labelRu

  // Pattern matching (covers source_slug values like "reddit_r_burningman", etc.)
  if (n.includes('extract_people_rpf'))    return FUNCTION_REGISTRY.extract_people_rpf.labelRu
  if (n.includes('extract_people_reddit')) return FUNCTION_REGISTRY.extract_people_reddit.labelRu
  if (n.includes('extract'))               return 'Извлечение людей'
  if (n.includes('osm') || n.includes('overpass')) return FUNCTION_REGISTRY.collector_osm_overpass.labelRu
  if (n.includes('google') && n.includes('place'))  return FUNCTION_REGISTRY.collector_google_places.labelRu
  if (n.includes('serper') || (n.includes('serp') && !n.includes('reddit'))) return FUNCTION_REGISTRY.collector_serp_serper.labelRu
  if (n.includes('reddit'))                return FUNCTION_REGISTRY.collector_reddit_rss.labelRu
  if (n.includes('digest') || n.includes('email'))  return FUNCTION_REGISTRY.digest_email_daily.labelRu
  if (n.includes('tg') || n.includes('telegram'))   return 'Telegram дайджест'
  if (n.includes('place'))                 return FUNCTION_REGISTRY.collector_google_places.labelRu

  return 'Неизвестная функция'
}

// ─── Status helpers ────────────────────────────────────────────────────────────

/** Map English DB status → Russian operator label */
export function getStatusLabelRu(status: string | null | undefined): string {
  if (!status) return 'Нет данных'
  switch (status.toLowerCase()) {
    case 'done':
    case 'success':
    case 'ok':
    case 'completed':   return 'Успешно'
    case 'error':
    case 'failed':
    case 'fail':
    case 'failed_retried': return 'Ошибка'
    case 'running':
    case 'in_progress':
    case 'active':
    case 'processing':  return 'Выполняется'
    case 'queued':
    case 'pending':
    case 'open':        return 'В очереди'
    case 'skipped':     return 'Пропущено'
    case 'canceled':
    case 'cancelled':   return 'Отменено'
    default:            return status
  }
}

/** Map status string → StatusDot variant */
export function getStatusVariant(
  status: string | null | undefined
): 'ok' | 'error' | 'running' | 'warn' | 'idle' {
  if (!status) return 'idle'
  switch (status.toLowerCase()) {
    case 'done': case 'success': case 'ok': case 'completed': return 'ok'
    case 'error': case 'failed': case 'fail': case 'failed_retried': return 'error'
    case 'running': case 'in_progress': case 'active': case 'processing': return 'running'
    case 'queued': case 'pending': case 'open': return 'warn'
    default: return 'idle'
  }
}

// ─── Error normalizer ─────────────────────────────────────────────────────────

/** Shorten a raw error string to a readable Russian summary. */
export function normalizeErrorRu(error: string | null | undefined): string | null {
  if (!error) return null
  const e = error.toLowerCase()

  if (e.includes('rate limit') || e.includes('ratelimit') || e.includes('too many requests') || e.includes('429'))
    return 'Лимит запросов (rate limit)'
  if (e.includes('quota') || e.includes('quota exceeded'))
    return 'Квота API исчерпана'
  if (e.includes('timeout') || e.includes('timed out') || e.includes('etimedout'))
    return 'Таймаут соединения'
  if (e.includes('network') || e.includes('econnrefused') || e.includes('enotfound') || e.includes('connection'))
    return 'Ошибка сети'
  if (e.includes('unauthorized') || e.includes('401') || e.includes('auth') || e.includes('api key'))
    return 'Ошибка авторизации'
  if (e.includes('not found') || e.includes('404'))
    return 'Ресурс не найден'
  if (e.includes('server error') || e.includes('500') || e.includes('502') || e.includes('503'))
    return 'Ошибка сервера'
  if (e.includes('no tasks') || e.includes('0 tasks'))
    return 'Нет задач для обработки'
  if (e.includes('dry_run') || e.includes('dry run'))
    return 'Тестовый запуск (dry run)'

  // Truncate to 80 chars — keep enough context
  return error.length > 80 ? error.slice(0, 80) + '…' : error
}
