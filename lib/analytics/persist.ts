import type { AnalyticsState } from './context'

const LS_KEY = 'feya_analytics_state'
const SB_DEFAULT_KEY = 'analytics_default'

// ─── localStorage ─────────────────────────────────────────────────────────────

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

// ─── Supabase ui_prefs ────────────────────────────────────────────────────────

/** Load analytics state from Supabase ui_prefs key="analytics_default" */
export async function loadStateFromSupabase(): Promise<Partial<AnalyticsState> | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch(`/api/actions/ui-prefs?key=${SB_DEFAULT_KEY}`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return (json?.value as Partial<AnalyticsState>) ?? null
  } catch {
    return null
  }
}

/** Save full analytics state to Supabase as the default preset (best-effort) */
export async function saveDefaultToSupabase(state: AnalyticsState): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    await fetch('/api/actions/ui-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: SB_DEFAULT_KEY, value: state }),
    })
  } catch {
    // non-critical
  }
}

/** Save a named preset to Supabase key="analytics_preset:<name>" */
export async function savePresetToSupabase(name: string, state: Partial<AnalyticsState>): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    await fetch('/api/actions/ui-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: `analytics_preset:${name}`, value: state }),
    })
  } catch {
    // non-critical
  }
}

/** Save a label override to ui_label_overrides */
export async function syncLabelToSupabase(scope: string, key: string, label: string): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    await fetch('/api/actions/ui-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, key, label }),
    })
  } catch {
    // non-critical
  }
}
