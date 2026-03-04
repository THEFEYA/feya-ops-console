import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ts
  }
}

export function formatRelative(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    const diff = Date.now() - new Date(ts).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'только что'
    if (minutes < 60) return `${minutes} мин назад`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} ч назад`
    const days = Math.floor(hours / 24)
    return `${days} д назад`
  } catch {
    return ts
  }
}

export function statusColor(status: string | undefined): string {
  if (!status) return 'text-gray-400'
  const s = status.toLowerCase()
  if (['ok', 'success', 'done', 'completed', 'approved'].includes(s)) return 'text-neon-green'
  if (['running', 'active', 'processing', 'in_progress'].includes(s)) return 'text-neon-cyan'
  if (['error', 'failed', 'rejected'].includes(s)) return 'text-neon-red'
  if (['warn', 'warning', 'queued', 'pending', 'shortlisted'].includes(s)) return 'text-neon-yellow'
  return 'text-gray-400'
}

export function warmthColor(warmth: string | undefined): string {
  if (!warmth) return 'text-gray-400'
  const w = warmth.toLowerCase()
  if (['hot', 'горячий', 'high'].includes(w)) return 'text-neon-red'
  if (['warm', 'тёплый', 'тепл', 'medium'].includes(w)) return 'text-neon-yellow'
  if (['cold', 'холодный', 'low'].includes(w)) return 'text-neon-cyan'
  return 'text-gray-400'
}

export function warmthLabel(warmth: string | undefined): string {
  if (!warmth) return '—'
  const w = warmth.toLowerCase()
  if (['hot', 'high'].includes(w)) return 'Горячий'
  if (['warm', 'medium'].includes(w)) return 'Тёплый'
  if (['cold', 'low'].includes(w)) return 'Холодный'
  return warmth
}

export function truncate(str: string | undefined, max = 80): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

export function getDashboardToken(): string {
  if (typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.search)
  const t = params.get('t')
  if (t) {
    sessionStorage.setItem('feya_token', t)
    return t
  }
  return sessionStorage.getItem('feya_token') ?? ''
}

export function buildApiUrl(path: string, extra?: Record<string, string>): string {
  const token = getDashboardToken()
  const params = new URLSearchParams({ ...(token ? { t: token } : {}), ...extra })
  return `${path}?${params.toString()}`
}
