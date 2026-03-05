import type { AnalyticsState } from './context'

const LS_KEY = 'feya_analytics_state'

export function loadState(): Partial<AnalyticsState> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<AnalyticsState>
  } catch {
    return null
  }
}

export function saveState(state: AnalyticsState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

// Best-effort Supabase sync — fire and forget
export async function syncPresetToSupabase(
  presetId: string,
  name: string,
  data: unknown
): Promise<void> {
  try {
    await fetch('/api/actions/ui-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'analytics_preset', key: presetId, value: { name, data } }),
    })
  } catch {
    // non-critical
  }
}

export async function syncLabelToSupabase(key: string, label: string): Promise<void> {
  try {
    await fetch('/api/actions/ui-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'label_override', key, value: label }),
    })
  } catch {
    // non-critical
  }
}
