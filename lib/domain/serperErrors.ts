/**
 * FEYA — SERP runtime error normalization.
 *
 * Translates raw error_text stored in `runs` table (e.g. "SERPER HTTP 400: ...")
 * into short Russian operator-facing labels with error categorization.
 */

export type SerperErrorCategory = 'auth' | 'quota' | 'bad_request' | 'server' | 'config' | 'unknown'

export interface SerperErrorInfo {
  /** Short Russian label for operator UI */
  labelRu: string
  /** Error category — used to distinguish error origin */
  category: SerperErrorCategory
  /** Raw Serper message from response body, if captured */
  rawMessage: string | null
  /** HTTP status code */
  httpCode: number
}

/**
 * Parse a SERP run error_text value of the form "SERPER HTTP <code>[: <message>]".
 * Returns null if the string does not match that pattern.
 */
export function parseSerperError(errorText: string | null | undefined): SerperErrorInfo | null {
  if (!errorText) return null
  const text = String(errorText).trim()

  const match = text.match(/^SERPER HTTP (\d+)(?::\s*(.*))?$/i)
  if (!match) return null

  const code = Number(match[1])
  const rawMessage = match[2]?.trim() || null
  const msg = (rawMessage ?? '').toLowerCase()

  // 401 or any "api key" / "unauthorized" message
  if (
    code === 401 ||
    msg.includes('invalid api key') ||
    msg.includes('api key') ||
    msg.includes('unauthorized')
  ) {
    return { labelRu: 'Неверный API-ключ Serper', category: 'auth', rawMessage, httpCode: code }
  }

  // 429 or quota/credits exhausted
  if (
    code === 429 ||
    msg.includes('rate limit') ||
    msg.includes('too many') ||
    msg.includes('quota') ||
    msg.includes('credit')
  ) {
    return { labelRu: 'Квота Serper исчерпана', category: 'quota', rawMessage, httpCode: code }
  }

  // 5xx — Serper server fault
  if (code >= 500) {
    return { labelRu: `Ошибка сервера Serper (${code})`, category: 'server', rawMessage, httpCode: code }
  }

  // 400 / 422 — bad request: try to decode specific sub-messages
  if (code === 400 || code === 422) {
    if (msg.includes('invalid api key') || msg.includes('api key')) {
      return { labelRu: 'Неверный API-ключ Serper', category: 'auth', rawMessage, httpCode: code }
    }
    if (msg.includes('credit') || msg.includes('quota')) {
      return { labelRu: 'Квота Serper исчерпана', category: 'quota', rawMessage, httpCode: code }
    }
    if (msg.includes('empty') || msg.includes('missing') || msg.includes('required')) {
      return { labelRu: 'Пустой или некорректный запрос', category: 'bad_request', rawMessage, httpCode: code }
    }
    if (rawMessage) {
      // Show truncated Serper message — now captured by v11+
      return {
        labelRu: `Ошибка запроса Serper: ${rawMessage.slice(0, 70)}`,
        category: 'bad_request',
        rawMessage,
        httpCode: code,
      }
    }
    return { labelRu: 'Некорректный запрос к Serper (400)', category: 'bad_request', rawMessage: null, httpCode: code }
  }

  // 403 — forbidden / plan restriction
  if (code === 403) {
    return { labelRu: 'Доступ к Serper запрещён (403)', category: 'auth', rawMessage, httpCode: code }
  }

  return { labelRu: `Ошибка Serper (HTTP ${code})`, category: 'unknown', rawMessage, httpCode: code }
}

/**
 * Convert a raw run error_text to a short Russian string for display.
 * Returns null if there is no error text.
 */
export function normalizeRunErrorRu(errorText: string | null | undefined): string | null {
  if (!errorText) return null
  const text = String(errorText).trim()
  if (!text) return null

  // Serper-specific errors
  const serper = parseSerperError(text)
  if (serper) return serper.labelRu

  // Generic error patterns
  const low = text.toLowerCase()
  if (low.includes('rate limit') || low.includes('too many requests')) return 'Лимит запросов превышен'
  if (low.includes('timeout') || low.includes('timed out')) return 'Таймаут соединения'
  if (low.includes('network') || low.includes('connection refused') || low.includes('econnrefused')) return 'Ошибка сети'
  if (low.includes('unauthorized') || low.includes('401')) return 'Ошибка авторизации'
  if (low.includes('not found') || low.includes('404')) return 'Ресурс не найден'
  if (low.includes('500') || low.includes('502') || low.includes('503')) return 'Ошибка сервера'
  if (low.includes('no tasks') || low.includes('nothing to process')) return 'Нет задач для обработки'

  // Return truncated raw error
  return text.length > 80 ? text.slice(0, 77) + '…' : text
}

/**
 * Convert a raw run status string to a Russian operator-facing label.
 */
export function getRunStatusLabelRu(status: string | null | undefined): string {
  if (!status) return 'Нет данных'
  switch (status.toLowerCase()) {
    case 'done':
    case 'success':
    case 'ok':
    case 'completed':
      return 'Успешно'
    case 'error':
    case 'failed':
    case 'fail':
    case 'failure':
      return 'Ошибка'
    case 'running':
    case 'in_progress':
    case 'active':
    case 'processing':
      return 'Выполняется'
    case 'queued':
    case 'pending':
    case 'open':
      return 'В очереди'
    case 'skipped':
      return 'Пропущено'
    case 'canceled':
    case 'cancelled':
      return 'Отменено'
    default:
      return status
  }
}
