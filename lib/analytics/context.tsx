'use client'

import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react'
import { loadState, saveState } from './persist'

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

const DEFAULT_STATE: AnalyticsState = {
  dateRange: { preset: '30d' },
  filters: [],
  chartConfig: DEFAULT_CHART_CONFIGS,
  theme: 'dark',
  activePreset: null,
  labelOverrides: {},
  presets: [],
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_DATE_RANGE'; payload: DateRange }
  | { type: 'TOGGLE_FILTER'; payload: ActiveFilter }
  | { type: 'REMOVE_FILTER'; payload: { dimension: string; value: string } }
  | { type: 'RESET_FILTERS' }
  | { type: 'UPDATE_CHART'; payload: Partial<ChartConfig> & { id: string } }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_LABEL'; payload: { key: string; label: string } }
  | { type: 'SAVE_PRESET'; payload: { name: string } }
  | { type: 'LOAD_PRESET'; payload: { id: string } }
  | { type: 'SET_DEFAULT_PRESET'; payload: { id: string } }
  | { type: 'DELETE_PRESET'; payload: { id: string } }
  | { type: 'HYDRATE'; payload: Partial<AnalyticsState> }

function reducer(state: AnalyticsState, action: Action): AnalyticsState {
  switch (action.type) {
    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.payload }

    case 'TOGGLE_FILTER': {
      const exists = state.filters.some(
        (f) => f.dimension === action.payload.dimension && f.value === action.payload.value
      )
      const filters = exists
        ? state.filters.filter(
            (f) => !(f.dimension === action.payload.dimension && f.value === action.payload.value)
          )
        : [...state.filters, action.payload]
      return { ...state, filters }
    }

    case 'REMOVE_FILTER':
      return {
        ...state,
        filters: state.filters.filter(
          (f) => !(f.dimension === action.payload.dimension && f.value === action.payload.value)
        ),
      }

    case 'RESET_FILTERS':
      return { ...state, filters: [] }

    case 'UPDATE_CHART': {
      const existing = state.chartConfig[action.payload.id] ?? {}
      return {
        ...state,
        chartConfig: {
          ...state.chartConfig,
          [action.payload.id]: { ...existing, ...action.payload } as ChartConfig,
        },
      }
    }

    case 'SET_THEME':
      return { ...state, theme: action.payload }

    case 'SET_LABEL':
      return {
        ...state,
        labelOverrides: { ...state.labelOverrides, [action.payload.key]: action.payload.label },
      }

    case 'SAVE_PRESET': {
      const { presets, ...rest } = state
      const id = `preset_${Date.now()}`
      const isDefault = presets.length === 0
      const newPreset: Preset = {
        id,
        name: action.payload.name,
        isDefault,
        state: rest,
      }
      return { ...state, presets: [...presets, newPreset], activePreset: id }
    }

    case 'LOAD_PRESET': {
      const preset = state.presets.find((p) => p.id === action.payload.id)
      if (!preset) return state
      return { ...state, ...preset.state, activePreset: preset.id, presets: state.presets }
    }

    case 'SET_DEFAULT_PRESET':
      return {
        ...state,
        presets: state.presets.map((p) => ({ ...p, isDefault: p.id === action.payload.id })),
      }

    case 'DELETE_PRESET':
      return {
        ...state,
        presets: state.presets.filter((p) => p.id !== action.payload.id),
        activePreset: state.activePreset === action.payload.id ? null : state.activePreset,
      }

    case 'HYDRATE':
      return { ...state, ...action.payload }

    default:
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

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = loadState()
    if (saved) {
      dispatch({ type: 'HYDRATE', payload: saved })
    }
  }, [])

  // Persist to localStorage on every state change
  useEffect(() => {
    saveState(state)
  }, [state])

  const getLabel = useCallback(
    (key: string, fallback?: string) => state.labelOverrides[key] ?? fallback ?? key,
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
