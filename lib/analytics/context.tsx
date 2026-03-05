'use client'

import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react'
import { loadState, saveState, loadStateFromSupabase, saveDefaultToSupabase } from './persist'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter'
export type Theme = 'dark' | 'light' | 'neon'
export type DatePreset = 'today' | '7d' | '30d' | '90d' | 'custom'

export interface DateRange {
  preset: DatePreset
  from?: string
  to?: string
}

export interface ActiveFilter {
  dimension: string
  value: string
}

export interface ChartConfig {
  id: string
  title: string
  type: ChartType
  metric: string
  groupBy: string
  collapsed: boolean
}

export interface Preset {
  id: string
  name: string
  isDefault: boolean
  state: Omit<AnalyticsState, 'presets'>
}

export interface AnalyticsState {
  dateRange: DateRange
  filters: ActiveFilter[]
  chartConfig: Record<string, ChartConfig>
  layout: string[]   // ordered chart card IDs for drag&drop
  theme: Theme
  activePreset: string | null
  labelOverrides: Record<string, string>
  presets: Preset[]
}

// ─── Default chart configs ────────────────────────────────────────────────────

export const DEFAULT_CHART_CONFIGS: Record<string, ChartConfig> = {
  daily: {
    id: 'daily',
    title: 'Динамика по дням',
    type: 'line',
    metric: 'leads_cnt',
    groupBy: 'day',
    collapsed: false,
  },
  bySource: {
    id: 'bySource',
    title: 'По источнику',
    type: 'bar',
    metric: 'leads_cnt',
    groupBy: 'source_slug',
    collapsed: false,
  },
  byWarmth: {
    id: 'byWarmth',
    title: 'По интенту',
    type: 'pie',
    metric: 'leads_cnt',
    groupBy: 'warmth',
    collapsed: false,
  },
  byEvent: {
    id: 'byEvent',
    title: 'По событию',
    type: 'bar',
    metric: 'leads_cnt',
    groupBy: 'event',
    collapsed: false,
  },
}

export const DEFAULT_LAYOUT = ['daily', 'bySource', 'byWarmth', 'byEvent']

export const DEFAULT_STATE: AnalyticsState = {
  dateRange: { preset: '30d' },
  filters: [],
  chartConfig: DEFAULT_CHART_CONFIGS,
  layout: DEFAULT_LAYOUT,
  theme: 'dark',
  activePreset: null,
  labelOverrides: {},
  presets: [],
}

// ─── State normalization ───────────────────────────────────────────────────────

const VALID_CHART_TYPES: ChartType[] = ['bar', 'line', 'area', 'pie', 'scatter']
const VALID_THEMES: Theme[] = ['dark', 'light', 'neon']
const VALID_DATE_PRESETS: DatePreset[] = ['today', '7d', '30d', '90d', 'custom']

function safeFilters(raw: unknown): ActiveFilter[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (f): f is ActiveFilter =>
      f !== null &&
      typeof f === 'object' &&
      typeof (f as ActiveFilter).dimension === 'string' &&
      typeof (f as ActiveFilter).value === 'string'
  )
}

function safePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (p): p is Preset =>
      p !== null &&
      typeof p === 'object' &&
      typeof (p as Preset).id === 'string' &&
      typeof (p as Preset).name === 'string'
  )
}

function safeChartConfig(raw: unknown): Record<string, ChartConfig> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_CHART_CONFIGS
  const result: Record<string, ChartConfig> = { ...DEFAULT_CHART_CONFIGS }
  for (const [id, cfg] of Object.entries(raw as Record<string, unknown>)) {
    if (!cfg || typeof cfg !== 'object') continue
    const c = cfg as Partial<ChartConfig>
    result[id] = {
      id: typeof c.id === 'string' ? c.id : id,
      title: typeof c.title === 'string' ? c.title : (DEFAULT_CHART_CONFIGS[id]?.title ?? id),
      type: VALID_CHART_TYPES.includes(c.type as ChartType) ? (c.type as ChartType) : 'bar',
      metric: typeof c.metric === 'string' ? c.metric : 'leads_cnt',
      groupBy: typeof c.groupBy === 'string' ? c.groupBy : 'day',
      collapsed: typeof c.collapsed === 'boolean' ? c.collapsed : false,
    }
  }
  return result
}

export function normalizeState(raw: unknown): Partial<AnalyticsState> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const r = raw as Record<string, unknown>

  const result: Partial<AnalyticsState> = {}

  // dateRange
  if (r.dateRange && typeof r.dateRange === 'object' && !Array.isArray(r.dateRange)) {
    const dr = r.dateRange as Record<string, unknown>
    if (VALID_DATE_PRESETS.includes(dr.preset as DatePreset)) {
      result.dateRange = {
        preset: dr.preset as DatePreset,
        from: typeof dr.from === 'string' ? dr.from : undefined,
        to: typeof dr.to === 'string' ? dr.to : undefined,
      }
    }
  }

  // filters
  result.filters = safeFilters(r.filters)

  // chartConfig
  if (r.chartConfig) {
    result.chartConfig = safeChartConfig(r.chartConfig)
  }

  // layout — must be string[]
  if (Array.isArray(r.layout) && r.layout.every((v) => typeof v === 'string') && r.layout.length > 0) {
    result.layout = r.layout as string[]
  }

  // theme
  if (VALID_THEMES.includes(r.theme as Theme)) {
    result.theme = r.theme as Theme
  }

  // activePreset
  if (r.activePreset === null || typeof r.activePreset === 'string') {
    result.activePreset = r.activePreset as string | null
  }

  // labelOverrides — must be Record<string, string>
  if (r.labelOverrides && typeof r.labelOverrides === 'object' && !Array.isArray(r.labelOverrides)) {
    const overrides: Record<string, string> = {}
    for (const [k, v] of Object.entries(r.labelOverrides as Record<string, unknown>)) {
      if (typeof v === 'string') overrides[k] = v
    }
    result.labelOverrides = overrides
  }

  // presets
  result.presets = safePresets(r.presets)

  return result
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_DATE_RANGE'; payload: DateRange }
  | { type: 'TOGGLE_FILTER'; payload: ActiveFilter }
  | { type: 'REMOVE_FILTER'; payload: { dimension: string; value: string } }
  | { type: 'RESET_FILTERS' }
  | { type: 'UPDATE_CHART'; payload: Partial<ChartConfig> & { id: string } }
  | { type: 'SET_LAYOUT'; payload: string[] }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_LABEL'; payload: { key: string; label: string } }
  | { type: 'SAVE_PRESET'; payload: { name: string; isDefault?: boolean } }
  | { type: 'LOAD_PRESET'; payload: { id: string } }
  | { type: 'SET_DEFAULT_PRESET'; payload: { id: string } }
  | { type: 'DELETE_PRESET'; payload: { id: string } }
  | { type: 'HYDRATE'; payload: Partial<AnalyticsState> }
  | { type: 'RESET_STATE' }

function reducer(state: AnalyticsState, action: Action): AnalyticsState {
  try {
    switch (action.type) {
      case 'SET_DATE_RANGE':
        return { ...state, dateRange: action.payload }

      case 'TOGGLE_FILTER': {
        const exists = (state.filters ?? []).some(
          (f) => f.dimension === action.payload.dimension && f.value === action.payload.value
        )
        const filters = exists
          ? (state.filters ?? []).filter(
              (f) => !(f.dimension === action.payload.dimension && f.value === action.payload.value)
            )
          : [...(state.filters ?? []), action.payload]
        return { ...state, filters }
      }

      case 'REMOVE_FILTER':
        return {
          ...state,
          filters: (state.filters ?? []).filter(
            (f) => !(f.dimension === action.payload.dimension && f.value === action.payload.value)
          ),
        }

      case 'RESET_FILTERS':
        return { ...state, filters: [] }

      case 'UPDATE_CHART': {
        const existing = (state.chartConfig ?? {})[action.payload.id] ?? {}
        return {
          ...state,
          chartConfig: {
            ...state.chartConfig,
            [action.payload.id]: { ...existing, ...action.payload } as ChartConfig,
          },
        }
      }

      case 'SET_LAYOUT':
        return { ...state, layout: Array.isArray(action.payload) ? action.payload : state.layout }

      case 'SET_THEME':
        return { ...state, theme: VALID_THEMES.includes(action.payload) ? action.payload : state.theme }

      case 'SET_LABEL':
        return {
          ...state,
          labelOverrides: { ...(state.labelOverrides ?? {}), [action.payload.key]: action.payload.label },
        }

      case 'SAVE_PRESET': {
        const { presets, ...rest } = state
        const id = `preset_${Date.now()}`
        const shouldBeDefault = action.payload.isDefault ?? (presets ?? []).length === 0
        const newPreset: Preset = {
          id,
          name: action.payload.name,
          isDefault: shouldBeDefault,
          state: rest,
        }
        const updatedPresets = shouldBeDefault
          ? (presets ?? []).map((p) => ({ ...p, isDefault: false }))
          : (presets ?? [])
        return { ...state, presets: [...updatedPresets, newPreset], activePreset: id }
      }

      case 'LOAD_PRESET': {
        const preset = (state.presets ?? []).find((p) => p.id === action.payload.id)
        if (!preset) return state
        return { ...state, ...preset.state, activePreset: preset.id, presets: state.presets }
      }

      case 'SET_DEFAULT_PRESET':
        return {
          ...state,
          presets: (state.presets ?? []).map((p) => ({ ...p, isDefault: p.id === action.payload.id })),
        }

      case 'DELETE_PRESET':
        return {
          ...state,
          presets: (state.presets ?? []).filter((p) => p.id !== action.payload.id),
          activePreset: state.activePreset === action.payload.id ? null : state.activePreset,
        }

      case 'HYDRATE':
        return { ...state, ...action.payload }

      case 'RESET_STATE':
        return { ...DEFAULT_STATE }

      default:
        return state
    }
  } catch (err) {
    console.warn('[Analytics] Reducer error, returning current state', err)
    return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AnalyticsContextValue {
  state: AnalyticsState
  dispatch: React.Dispatch<Action>
  getLabel: (key: string, fallback?: string) => string
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE)

  // Hydrate: Supabase analytics_default → localStorage → built-in default
  useEffect(() => {
    async function init() {
      // 1. Apply localStorage immediately (sync), wrapped in try/catch
      try {
        const lsRaw = loadState()
        if (lsRaw) {
          const lsState = normalizeState(lsRaw)
          if (Object.keys(lsState).length > 0) {
            dispatch({ type: 'HYDRATE', payload: lsState })
          }
        }
      } catch (err) {
        console.warn('[Analytics] Failed to load from localStorage, using defaults', err)
      }

      // 2. Try Supabase async — override if found
      try {
        const sbRaw = await loadStateFromSupabase()
        if (sbRaw) {
          const sbState = normalizeState(sbRaw)
          if (Object.keys(sbState).length > 0) {
            dispatch({ type: 'HYDRATE', payload: sbState })
          }
        }
      } catch (err) {
        console.warn('[Analytics] Failed to load from Supabase, keeping local state', err)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      saveState(state)
    } catch {
      // best-effort
    }
  }, [state])

  // Sync default preset to Supabase when presets change
  useEffect(() => {
    const defaultPreset = (state.presets ?? []).find((p) => p.isDefault)
    if (defaultPreset) {
      saveDefaultToSupabase(state).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.presets])

  const getLabel = useCallback(
    (key: string, fallback?: string) => {
      try {
        return (state.labelOverrides ?? {})[key] ?? fallback ?? key
      } catch {
        return fallback ?? key
      }
    },
    [state.labelOverrides]
  )

  return (
    <AnalyticsContext.Provider value={{ state, dispatch, getLabel }}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext)
  if (!ctx) throw new Error('useAnalytics must be used within AnalyticsProvider')
  return ctx
}
