'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter,
  Legend,
} from 'recharts'
import { NeonCard } from '@/components/shared/NeonCard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { PivotTable } from '@/components/analytics/PivotTable'
import { FilterChips } from '@/components/analytics/FilterChips'
import { ChartCard } from '@/components/analytics/ChartCard'
import { PresetBar } from '@/components/analytics/PresetBar'
import { AiPanel } from '@/components/analytics/AiPanel'
import { AnalyticsProvider, useAnalytics, ALL_KNOWN_CHART_DEFAULTS, REQUIRED_LAYOUT, type ChartConfig } from '@/lib/analytics/context'
import { AnalyticsErrorBoundary } from '@/components/analytics/ErrorBoundary'
import { buildApiUrl } from '@/lib/utils'
import { BarChart3, RefreshCw, Sun, Moon, Zap, RotateCcw, Lock, Unlock } from 'lucide-react'

const LS_KEY = 'feya_analytics_state'

const NEON_COLORS = ['#00e5ff', '#00ff88', '#ffcc00', '#ff3355', '#cc44ff', '#4488ff', '#ff9900', '#44ffcc']

// ─── Tooltip styles — high-contrast dark regardless of page theme ──────────────
const tooltipStyle = {
  backgroundColor: '#111827',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  color: '#f9fafb',
  fontSize: '12px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
}
const labelStyle = { color: '#e5e7eb', fontWeight: 600 }
const itemStyle = { color: '#d1d5db' }

type RollupRow = Record<string, unknown>
type KpiRow = Record<string, unknown>
type Period = 'today' | '7d' | '30d' | '90d' | 'custom'

// ─── Funnel types ──────────────────────────────────────────────────────────────
interface FunnelRow {
  source_slug?: string
  day?: string
  leads_captured?: number
  approved?: number
  shortlisted?: number
  rejected?: number
  qualified?: number
  contacted?: number
  replied?: number
  meeting?: number
  proposal?: number
  won?: number
  lost?: number
  conversion_rate?: number
}

const PERIOD_OPTIONS: { key: Period; label: string; days: number }[] = [
  { key: 'today', label: 'Сегодня', days: 1 },
  { key: '7d', label: '7 дн.', days: 7 },
  { key: '30d', label: '30 дн.', days: 30 },
  { key: '90d', label: '90 дн.', days: 90 },
  { key: 'custom', label: 'Свой', days: 0 },
]

// Dimensions that v_source_funnel_daily actually has — used to isolate funnel from unsupported filters
const SUPPORTED_FUNNEL_FILTERS = ['source_slug', 'source_platform', 'source_family', 'lead_kind'] as const
type SupportedFunnelFilter = (typeof SUPPORTED_FUNNEL_FILTERS)[number]

// ─── Data helpers ─────────────────────────────────────────────────────────────

function aggBy(
  rows: RollupRow[],
  groupKey: string,
  valueKey = 'leads_cnt'
): { name: string; value: number }[] {
  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const k = String(row[groupKey] ?? '').trim()
    if (!k) continue
    const v = Number(row[valueKey] ?? 0)
    if (valueKey.startsWith('avg_')) {
      const cnt = Number(row['leads_cnt'] ?? 1)
      sums[k] = (sums[k] ?? 0) + v * cnt
      counts[k] = (counts[k] ?? 0) + cnt
    } else {
      sums[k] = (sums[k] ?? 0) + v
    }
  }
  return Object.entries(sums)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, value]) => ({
      name: name.slice(0, 24),
      value: valueKey.startsWith('avg_')
        ? Math.round((value / (counts[name] ?? 1)) * 10) / 10
        : Math.round(value * 10) / 10,
    }))
}

function dailySeries(rows: RollupRow[], valueKey = 'leads_cnt') {
  const byDay: Record<string, { sum: number; cnt: number }> = {}
  for (const row of rows) {
    const day = String(row['day'] ?? '').slice(0, 10)
    if (!day) continue
    const c = Number(row['leads_cnt'] ?? 0)
    const v = Number(row[valueKey] ?? 0)
    if (!byDay[day]) byDay[day] = { sum: 0, cnt: 0 }
    byDay[day].sum += valueKey.startsWith('avg_') ? v * c : v
    byDay[day].cnt += c
  }
  return Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({
      name: day.slice(5),
      value: valueKey.startsWith('avg_') && v.cnt > 0
        ? Math.round(v.sum / v.cnt)
        : v.sum,
    }))
}

function getPeriodParams(period: Period, customFrom: string, customTo: string): Record<string, string> {
  if (period === 'today') {
    const today = new Date().toISOString().slice(0, 10)
    return { date_from: today, date_to: today }
  }
  if (period === 'custom' && customFrom && customTo) {
    return { date_from: customFrom, date_to: customTo }
  }
  const days = PERIOD_OPTIONS.find((p) => p.key === period)?.days ?? 30
  return { limit: String(days) }
}

function applyFilters(rows: RollupRow[], filters: { dimension: string; value: string }[]): RollupRow[] {
  if (filters.length === 0) return rows
  return rows.filter((row) =>
    filters.every((f) => String(row[f.dimension] ?? '') === f.value)
  )
}

function kpiVal(row: KpiRow, ...keys: string[]): number {
  for (const k of keys) {
    const v = Number(row[k] ?? NaN)
    if (!isNaN(v) && v > 0) return v
  }
  return 0
}

// ─── Funnel helpers ────────────────────────────────────────────────────────────

interface FunnelSourceAgg {
  source: string
  leads: number
  approved: number
  shortlisted: number
  rejected: number
  qualified: number
  won: number
  rate: number           // approved / leads * 100
  shortlisted_rate: number
  rejected_rate: number
}

function aggregateFunnelBySource(rows: FunnelRow[]): FunnelSourceAgg[] {
  const agg: Record<string, Omit<FunnelSourceAgg, 'source' | 'rate' | 'shortlisted_rate' | 'rejected_rate'>> = {}
  for (const r of rows) {
    const s = (r.source_slug ?? '').trim()
    if (!s) continue
    if (!agg[s]) agg[s] = { leads: 0, approved: 0, shortlisted: 0, rejected: 0, qualified: 0, won: 0 }
    agg[s].leads      += r.leads_captured ?? 0
    agg[s].approved   += r.approved       ?? 0
    agg[s].shortlisted+= r.shortlisted    ?? 0
    agg[s].rejected   += r.rejected       ?? 0
    agg[s].qualified  += r.qualified      ?? 0
    agg[s].won        += r.won            ?? 0
  }
  return Object.entries(agg)
    .filter(([, v]) => v.leads > 0)
    .map(([source, v]) => ({
      source,
      ...v,
      rate:             Math.round((v.approved   / v.leads) * 1000) / 10,
      shortlisted_rate: Math.round((v.shortlisted / v.leads) * 1000) / 10,
      rejected_rate:    Math.round((v.rejected    / v.leads) * 1000) / 10,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 12)
}

interface FunnelDayPoint { day: string; leads: number; approved: number; rate: number }

function aggregateFunnelByDay(rows: FunnelRow[]): FunnelDayPoint[] {
  const byDay: Record<string, { leads: number; approved: number }> = {}
  for (const r of rows) {
    const d = (r.day ?? '').slice(0, 10)
    if (!d) continue
    if (!byDay[d]) byDay[d] = { leads: 0, approved: 0 }
    byDay[d].leads    += r.leads_captured ?? 0
    byDay[d].approved += r.approved       ?? 0
  }
  return Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({
      day: day.slice(5),   // MM-DD
      leads: v.leads,
      approved: v.approved,
      rate: v.leads > 0 ? Math.round((v.approved / v.leads) * 1000) / 10 : 0,
    }))
}

// ─── Conversion helpers (fallback when funnel views are empty) ─────────────────

function conversionBy(
  rows: RollupRow[],
  groupKey: string
): { name: string; total: number; approved: number; rate: number }[] {
  const totals: Record<string, number> = {}
  const approved: Record<string, number> = {}
  for (const r of rows) {
    const k = String(r[groupKey] ?? '').trim()
    if (!k) continue
    totals[k] = (totals[k] ?? 0) + Number(r['leads_cnt'] ?? 0)
    // Accept either explicit approved_cnt column or outcome='approved'
    const approvedDelta =
      r['approved_cnt'] !== undefined
        ? Number(r['approved_cnt'] ?? 0)
        : String(r['outcome'] ?? '') === 'approved'
          ? Number(r['leads_cnt'] ?? 0)
          : 0
    approved[k] = (approved[k] ?? 0) + approvedDelta
  }
  const hasData = Object.values(approved).some((v) => v > 0)
  if (!hasData) return []
  return Object.entries(totals)
    .filter(([, t]) => t > 0)
    .map(([name, total]) => ({
      name: name.slice(0, 22),
      total,
      approved: approved[name] ?? 0,
      rate: Math.round(((approved[name] ?? 0) / total) * 1000) / 10,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8)
}

// ─── Pie label ────────────────────────────────────────────────────────────────

function PieLabel({ cx, cy, midAngle, outerRadius, percent, name }: {
  cx: number; cy: number; midAngle: number; outerRadius: number; percent: number; name: string
}) {
  if (percent < 0.04) return null
  const RADIAN = Math.PI / 180
  const r = outerRadius + 22
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#f9fafb" fontSize={10} fontWeight={500} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
      {`${name.slice(0, 12)} ${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── Universal chart renderer ─────────────────────────────────────────────────

function UniversalChart({
  config,
  rows,
  onCrossFilter,
}: {
  config: ChartConfig
  rows: RollupRow[]
  onCrossFilter: (dimension: string, value: string) => void
}) {
  const { getLabel } = useAnalytics()
  const isTimeSeries = config.groupBy === 'day'
  const data = isTimeSeries ? dailySeries(rows, config.metric) : aggBy(rows, config.groupBy, config.metric)
  // Formatter for axis ticks — shows label override but keeps raw value for cross-filter
  const labelFmt = (v: string) => getLabel(v, v)

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">Нет данных по группировке «{config.groupBy}»</p>
  }

  const handleClick = (d: unknown) => {
    const item = d as { activePayload?: { payload?: { name?: string } }[] } | null
    const name = item?.activePayload?.[0]?.payload?.name
    if (name) onCrossFilter(config.groupBy, name)
  }

  const coloredData = data.map((d, i) => ({ ...d, fill: NEON_COLORS[i % NEON_COLORS.length] }))

  const labeledData = coloredData.map((d) => ({ ...d, displayName: getLabel(d.name, d.name) }))

  if (config.type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={labeledData.map((d) => ({ ...d, name: d.displayName }))}
            cx="50%"
            cy="50%"
            outerRadius={80}
            dataKey="value"
            labelLine={false}
            label={PieLabel as unknown as boolean}
            onClick={(d: { name?: string }) => {
              // Find raw name for cross-filter
              const raw = coloredData.find((c) => getLabel(c.name, c.name) === d?.name)?.name ?? d?.name
              if (raw) onCrossFilter(config.groupBy, raw)
            }}
            style={{ cursor: 'pointer' }}
          >
            {labeledData.map((_, i) => <Cell key={i} fill={coloredData[i]?.fill ?? NEON_COLORS[i % NEON_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} itemStyle={itemStyle} />
          <Legend formatter={(v) => <span style={{ color: '#e5e7eb', fontSize: 11, fontWeight: 500 }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (config.type === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
          <XAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis dataKey="value" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={itemStyle} />
          <Scatter data={data} fill="#00e5ff" onClick={(d) => { if (d?.name) onCrossFilter(config.groupBy, String(d.name)) }} style={{ cursor: 'pointer' }} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  const commonProps = {
    data,
    margin: { left: 0, right: 8 },
    onClick: handleClick,
    style: { cursor: 'pointer' },
  }

  if (config.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={labelFmt} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} labelFormatter={labelFmt} />
          <Line type="monotone" dataKey="value" name={config.metric} stroke="#00e5ff" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (config.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={labelFmt} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} labelFormatter={labelFmt} />
          <Area type="monotone" dataKey="value" name={config.metric} stroke="#00e5ff" fill="#00e5ff22" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // Default: bar
  const isVertical = !isTimeSeries && data.length > 6
  return (
    <ResponsiveContainer width="100%" height={isVertical ? Math.max(200, data.length * 28) : 220}>
      {isVertical ? (
        <BarChart data={data} layout="vertical" margin={{ left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={100} tickFormatter={labelFmt} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} labelFormatter={labelFmt} />
          <Bar dataKey="value" name={config.metric} radius={[0, 4, 4, 0]} onClick={(d) => { if (d?.name) onCrossFilter(config.groupBy, String(d.name)) }} style={{ cursor: 'pointer' }}>
            {data.map((_, i) => <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} />)}
          </Bar>
        </BarChart>
      ) : (
        <BarChart data={data} margin={{ left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={labelFmt} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} labelFormatter={labelFmt} />
          <Bar dataKey="value" name={config.metric} fill="#00e5ff" radius={[3, 3, 0, 0]} onClick={(d) => { if (d?.name) onCrossFilter(config.groupBy, String(d.name)) }} style={{ cursor: 'pointer' }}>
            {data.map((_, i) => <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} />)}
          </Bar>
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}

// ─── Inner page (requires AnalyticsProvider) ──────────────────────────────────

function AnalyticsInner({ safeMode }: { safeMode: boolean }) {
  const { state, dispatch } = useAnalytics()
  const [allRows, setAllRows] = useState<RollupRow[] | null>(null)
  const [kpi, setKpi] = useState<KpiRow | null>(null)
  const [funnelRows, setFunnelRows] = useState<FunnelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Toast notification for cross-filter actions
  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  // Lock filters — when on, chart clicks don't add new filters
  const [filtersLocked, setFiltersLocked] = useState(false)

  // Drag & drop state for chart card reordering
  const [dragId, setDragId] = useState<string | null>(null)
  // Safe layout: always falls back to REQUIRED_LAYOUT, filters to known chart IDs only
  const layout = (state.layout?.length ? state.layout : REQUIRED_LAYOUT)
    .filter((id) => !['kpis', 'pivot'].includes(id))

  // Apply cross-filters client-side
  const rows = useMemo(
    () => applyFilters(allRows ?? [], state.filters),
    [allRows, state.filters]
  )

  // Compute distinct values per groupBy dimension for label rename
  const getDistinctValues = useCallback((groupBy: string): string[] => {
    if (!rows.length || !groupBy || groupBy === 'day') return []
    const vals = new Set<string>()
    for (const r of rows) {
      const v = String(r[groupBy] ?? '').trim()
      if (v) vals.add(v)
    }
    return Array.from(vals).slice(0, 20)
  }, [rows])

  const handleCrossFilter = useCallback(
    (dimension: string, value: string) => {
      if (filtersLocked) {
        showToast('Фильтры заблокированы')
        return
      }
      dispatch({ type: 'TOGGLE_FILTER', payload: { dimension, value } })
      showToast(`Фильтр: ${dimension}=${value}`)
    },
    [dispatch, filtersLocked, showToast]
  )

  // Local focus stage for conversion block (does NOT add to global filters)
  const [focusStage, setFocusStage] = useState<'approved' | 'shortlisted' | 'rejected' | null>(null)

  // ── ALL conversion/funnel memos — MUST be before any early return (Rules of Hooks) ──
  const convBySource = useMemo(() => conversionBy(rows, 'source_slug'), [rows])
  const convByEvent  = useMemo(() => conversionBy(rows, 'event'),       [rows])

  // Funnel: apply ONLY supported filter dims, ignore the rest
  const funnelFilteredRows = useMemo(() => {
    const supported = state.filters.filter(
      (f) => SUPPORTED_FUNNEL_FILTERS.includes(f.dimension as SupportedFunnelFilter)
    )
    return applyFilters(funnelRows as unknown as RollupRow[], supported) as FunnelRow[]
  }, [funnelRows, state.filters])

  // Filters that are active but NOT supported by the funnel view
  const ignoredFunnelFilters = useMemo(
    () =>
      state.filters
        .filter((f) => !SUPPORTED_FUNNEL_FILTERS.includes(f.dimension as SupportedFunnelFilter))
        .map((f) => f.dimension)
        .filter((v, i, a) => a.indexOf(v) === i), // unique
    [state.filters]
  )

  const funnelBySource = useMemo(() => aggregateFunnelBySource(funnelFilteredRows), [funnelFilteredRows])
  const funnelByDay    = useMemo(() => aggregateFunnelByDay(funnelFilteredRows),    [funnelFilteredRows])

  // Sync period from context dateRange preset
  useEffect(() => {
    if (state.dateRange.preset !== 'custom') {
      setPeriod(state.dateRange.preset)
    }
  }, [state.dateRange.preset])

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setErrorMsg(null)
      try {
        const pParams = getPeriodParams(period, customFrom, customTo)
        // One shared dataset: rollup2 (falls back to rollup server-side)
        const rollupUrl = buildApiUrl('/api/sb/query', { name: 'lead_analytics_rollup2', ...pParams })
        const kpiUrl    = buildApiUrl('/api/sb/query', { name: 'kpi_today_counts' })
        const funnelUrl = buildApiUrl('/api/sb/query', { name: 'v_source_funnel_daily', ...pParams })
        const [rollupRes, kpiRes, funnelRes] = await Promise.all([
          fetch(rollupUrl,  { cache: 'no-store' }),
          fetch(kpiUrl,     { cache: 'no-store' }),
          fetch(funnelUrl,  { cache: 'no-store' }),
        ])
        if (!rollupRes.ok) {
          const text = (await rollupRes.text()).slice(0, 500)
          if (!cancelled) setErrorMsg(`HTTP ${rollupRes.status}: ${text}`)
          return
        }
        const json = await rollupRes.json()
        if (!cancelled) setAllRows(json.data ?? [])

        if (kpiRes.ok) {
          const kpiJson = await kpiRes.json()
          if (!cancelled) setKpi(kpiJson.data ?? null)
        }

        // Funnel data — best-effort, don't block main render on failure
        if (funnelRes.ok) {
          const funnelJson = await funnelRes.json()
          if (!cancelled) setFunnelRows(funnelJson.data ?? [])
        }
      } catch (e) {
        if (!cancelled) setErrorMsg(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [period, customFrom, customTo])

  // Update context dateRange when period changes
  function handlePeriodChange(p: Period) {
    setPeriod(p)
    if (p !== 'custom') {
      dispatch({ type: 'SET_DATE_RANGE', payload: { preset: p } })
    }
  }

  const themeIcons = { dark: Moon, light: Sun, neon: Zap }
  const ThemeIcon = themeIcons[state.theme]

  const periodBar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-border overflow-hidden text-xs">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => handlePeriodChange(opt.key)}
            className={`px-3 py-1.5 transition-colors ${
              period === opt.key
                ? 'bg-neon-cyan/20 text-neon-cyan font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="flex items-center gap-2 text-xs">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
          />
        </div>
      )}
      {loading && <RefreshCw className="w-4 h-4 text-neon-cyan animate-spin" />}
    </div>
  )

  if (loading && allRows === null) return (
    <div className="space-y-4">
      {periodBar}
      <LoadingSpinner />
    </div>
  )

  if (errorMsg || allRows === null) {
    return (
      <div className="space-y-4">
        {periodBar}
        {errorMsg && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs font-mono">
            <p className="font-semibold text-red-400 mb-1">Ошибка загрузки аналитики</p>
            <p className="text-red-300 whitespace-pre-wrap break-all">{errorMsg}</p>
          </div>
        )}
        <EmptyState icon={BarChart3} title="Нет данных" description="Проверьте витрину lead_analytics_rollup2 / lead_analytics_rollup" />
      </div>
    )
  }

  if (allRows.length === 0) {
    return (
      <div className="space-y-4">
        {periodBar}
        <EmptyState icon={BarChart3} title="Данных за период нет" description="Попробуйте расширить диапазон дат" />
      </div>
    )
  }

  const totalLeads = rows.reduce((s, r) => s + Number(r['leads_cnt'] ?? 0), 0)
  const kpiCards = [
    { label: 'Лиды (период)', value: totalLeads },
    kpi ? { label: 'Лиды сегодня', value: kpiVal(kpi, 'leads_today', 'leads_cnt_today') } : null,
    kpi ? { label: 'Одобрено', value: kpiVal(kpi, 'approved_today', 'approved_cnt') } : null,
    kpi ? { label: 'Отклонено', value: kpiVal(kpi, 'rejected_today', 'rejected_cnt') } : null,
  ].filter((c): c is { label: string; value: number } => c !== null && c.value > 0)

  // Drag handlers
  function handleDragStart(id: string) {
    try { setDragId(id) } catch { /* ignore */ }
  }
  function handleDragOver(e: React.DragEvent, overId: string) {
    try {
      e.preventDefault()
      if (!dragId || dragId === overId) return
      const newLayout = [...layout]
      const fromIdx = newLayout.indexOf(dragId)
      const toIdx = newLayout.indexOf(overId)
      if (fromIdx === -1 || toIdx === -1) return
      newLayout.splice(fromIdx, 1)
      newLayout.splice(toIdx, 0, dragId)
      dispatch({ type: 'SET_LAYOUT', payload: newLayout })
    } catch { /* ignore */ }
  }
  function handleDragEnd() { try { setDragId(null) } catch { /* ignore */ } }

  return (
    <div className="space-y-4 animate-fade-in" data-theme={state.theme !== 'dark' ? state.theme : undefined}>
      {/* Safe-mode banner */}
      {safeMode && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
          🛡 Safe mode active — AiPanel, conversion block, toast и lock-filters отключены. Уберите <code className="font-mono">?safe=1</code> для полного режима.
        </div>
      )}

      {/* Toast notification */}
      {!safeMode && toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-900 border border-neon-cyan/40 text-neon-cyan text-xs px-3 py-2 rounded-lg shadow-lg animate-fade-in pointer-events-none">
          {toast}
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        {periodBar}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Lock filters — hidden in safe mode */}
          {!safeMode && (
            <button
              onClick={() => setFiltersLocked((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs transition-colors ${
                filtersLocked
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
              }`}
              title={filtersLocked ? 'Фильтры заблокированы — клики не меняют фильтры' : 'Заблокировать фильтры'}
            >
              {filtersLocked ? <Lock size={13} /> : <Unlock size={13} />}
              {filtersLocked ? 'Locked' : 'Lock'}
            </button>
          )}
          {/* Theme switcher */}
          <button
            onClick={() => {
              const themes = ['dark', 'light', 'neon'] as const
              const next = themes[(themes.indexOf(state.theme) + 1) % themes.length]
              dispatch({ type: 'SET_THEME', payload: next })
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            title={`Тема: ${state.theme}`}
          >
            <ThemeIcon size={13} />
            {state.theme}
          </button>
          <PresetBar />
          {!safeMode && <AiPanel rows={rows} />}
          {/* Reset button */}
          <button
            onClick={() => {
              try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
              dispatch({ type: 'RESET_STATE' })
              fetch('/api/actions/ui-prefs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'analytics_default', value: null }),
              }).catch(() => {})
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition-colors"
            title="Сбросить настройки аналитики"
          >
            <RotateCcw size={13} />
            Сброс
          </button>
        </div>
      </div>

      {/* Active filters */}
      <FilterChips />

      {/* Cross-filter notice */}
      {state.filters.length > 0 && (
        <p className="text-[10px] text-muted-foreground/60">
          Показано {rows.length} из {allRows.length} строк · Кликните на элемент графика для добавления фильтра
        </p>
      )}

      {/* KPI strip */}
      {kpiCards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpiCards.map((c) => (
            <NeonCard key={c.label} className="text-center py-3">
              <div className="text-2xl font-bold font-mono text-neon-cyan">{c.value.toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{c.label}</div>
            </NeonCard>
          ))}
        </div>
      )}

      {/* Debug: layout diagnostic */}
      <p className="text-[10px] text-muted-foreground/40 font-mono">
        layout: {layout.length} · cards rendered: {layout.filter((id) => !!(state.chartConfig[id] ?? ALL_KNOWN_CHART_DEFAULTS[id])).length}
      </p>

      {/* Configurable charts — drag&drop reorderable */}
      <div className="space-y-4">
        {layout.map((chartId) => {
          // Use live chartConfig first, fall back to any known default (covers legacy IDs)
          const defaultCfg = state.chartConfig[chartId] ?? ALL_KNOWN_CHART_DEFAULTS[chartId]
          if (!defaultCfg) return null
          return (
            <div
              key={chartId}
              draggable
              onDragStart={() => handleDragStart(chartId)}
              onDragOver={(e) => handleDragOver(e, chartId)}
              onDragEnd={handleDragEnd}
              className={`transition-opacity ${dragId === chartId ? 'opacity-40' : 'opacity-100'}`}
            >
              <ChartCard
                chartId={chartId}
                defaultTitle={defaultCfg.title}
                distinctValues={getDistinctValues((state.chartConfig[chartId] ?? defaultCfg).groupBy)}
              >
                {(config: ChartConfig) => (
                  <UniversalChart config={config} rows={rows} onCrossFilter={handleCrossFilter} />
                )}
              </ChartCard>
            </div>
          )
        })}
      </div>

      {/* Pivot table */}
      <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-secondary/30">
          <span className="text-sm font-medium">Сводная таблица</span>
          <p className="text-[10px] text-muted-foreground/60">Двойной клик на заголовке графика — переименовать · Перетащите карточки для изменения порядка</p>
        </div>
        <div className="p-4">
          <PivotTable rows={rows} onCrossFilter={handleCrossFilter} />
        </div>
      </div>

      {/* Conversion block — shown whenever funnel data exists; never hidden by unsupported filters */}
      {!safeMode && (funnelRows.length > 0 || convBySource.length > 0 || convByEvent.length > 0) && (
        <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-secondary/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Конверсия</span>
              {funnelRows.length > 0
                ? <span className="text-[10px] text-neon-cyan/70 border border-neon-cyan/30 rounded px-1.5 py-0.5">v_source_funnel_daily</span>
                : <span className="text-[10px] text-muted-foreground/60">расчёт из rollup</span>
              }
            </div>
            {/* Local focus-stage toggles — do NOT affect global filters */}
            <div className="flex items-center gap-1.5">
              {(['approved', 'shortlisted', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFocusStage((prev) => prev === s ? null : s)}
                  className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                    focusStage === s
                      ? s === 'approved'   ? 'bg-neon-green/20 border-neon-green/40 text-neon-green'
                      : s === 'shortlisted' ? 'bg-neon-cyan/20 border-neon-cyan/40 text-neon-cyan'
                      :                       'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {{ approved: 'Одобрено', shortlisted: 'Шортлист', rejected: 'Отклонено' }[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Ignored-filters notice */}
          {ignoredFunnelFilters.length > 0 && (
            <div className="px-4 pt-2.5 pb-0">
              <p className="text-[10px] text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded px-2 py-1.5">
                Конверсия не учитывает фильтры: <span className="font-mono">{ignoredFunnelFilters.join(', ')}</span>.
                Для детализации по событию/персоне нужна витрина funnel_by_event (в плане).
              </p>
            </div>
          )}

          {/* Native funnel view — v_source_funnel_daily */}
          {funnelRows.length > 0 && (
            <div className="p-4 space-y-4">
              {funnelBySource.length === 0 && (
                <p className="text-xs text-muted-foreground/70 text-center py-2">
                  Нет данных по текущим фильтрам источника. Сбросьте фильтры или расширьте период.
                </p>
              )}
              {funnelBySource.length > 0 && (
                <>
                  {/* By-source table */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">По источнику</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border/40">
                            <th className="text-left py-1 pr-3 font-medium w-36">Источник</th>
                            <th className="text-right py-1 px-2 font-medium">Лиды</th>
                            <th className="text-right py-1 px-2 font-medium">Квалиф.</th>
                            <th className={`text-right py-1 px-2 font-medium ${focusStage === 'approved' ? 'text-neon-green' : ''}`}>Одобрено</th>
                            <th className={`text-right py-1 px-2 font-medium ${focusStage === 'shortlisted' ? 'text-neon-cyan' : ''}`}>Шортлист</th>
                            <th className="text-right py-1 px-2 font-medium">Won</th>
                            <th className="text-left py-1 pl-3 font-medium w-28">
                              {focusStage === 'shortlisted' ? 'Шортлист %' : focusStage === 'rejected' ? 'Откл. %' : 'Одобр. %'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {funnelBySource.map((r) => {
                            const displayRate =
                              focusStage === 'shortlisted' ? r.shortlisted_rate
                              : focusStage === 'rejected'  ? r.rejected_rate
                              : r.rate
                            const rateColor =
                              focusStage === 'shortlisted' ? 'text-neon-cyan'
                              : focusStage === 'rejected'  ? 'text-red-400'
                              : 'text-neon-green'
                            const barColor =
                              focusStage === 'shortlisted' ? 'bg-neon-cyan'
                              : focusStage === 'rejected'  ? 'bg-red-400'
                              : 'bg-neon-green'
                            return (
                              <tr key={r.source} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                                <td className="py-1.5 pr-3">
                                  <button
                                    onClick={() => handleCrossFilter('source_slug', r.source)}
                                    className="text-foreground/80 hover:text-neon-cyan transition-colors text-left truncate max-w-[130px] block"
                                    title={`Фильтр: source_slug=${r.source}`}
                                  >
                                    {r.source}
                                  </button>
                                </td>
                                <td className="text-right py-1.5 px-2 font-mono text-muted-foreground">{r.leads.toLocaleString()}</td>
                                <td className="text-right py-1.5 px-2 font-mono text-blue-400">{r.qualified.toLocaleString()}</td>
                                <td className={`text-right py-1.5 px-2 font-mono ${focusStage === 'approved' ? 'text-neon-green font-bold' : 'text-neon-green/70'}`}>{r.approved.toLocaleString()}</td>
                                <td className={`text-right py-1.5 px-2 font-mono ${focusStage === 'shortlisted' ? 'text-neon-cyan font-bold' : 'text-neon-cyan/70'}`}>{r.shortlisted.toLocaleString()}</td>
                                <td className="text-right py-1.5 px-2 font-mono text-emerald-400">{r.won.toLocaleString()}</td>
                                <td className="py-1.5 pl-3">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${barColor} rounded-full transition-all`}
                                        style={{ width: `${Math.min(displayRate, 100)}%` }}
                                      />
                                    </div>
                                    <span className={`font-mono ${rateColor} w-10 text-right shrink-0`}>{displayRate}%</span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Day trend — leads vs focused stage */}
                  {funnelByDay.length > 1 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Тренд по дням</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={funnelByDay} margin={{ left: 0, right: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                          <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                          <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 9 }} unit="%" domain={[0, 100]} />
                          <Tooltip contentStyle={tooltipStyle} itemStyle={itemStyle} labelStyle={labelStyle} />
                          <Bar yAxisId="left" dataKey="leads"    name="Лиды"    fill="#4488ff" radius={[2, 2, 0, 0]} />
                          <Bar yAxisId="left" dataKey="approved" name="Одобрено" fill="#00ff88" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Fallback: client-side computation when funnel view is empty */}
          {funnelRows.length === 0 && (convBySource.length > 0 || convByEvent.length > 0) && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {convBySource.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">По источнику</p>
                  <div className="space-y-1.5">
                    {convBySource.map((r) => (
                      <div key={r.name} className="flex items-center gap-2">
                        <button
                          className="text-xs text-foreground/80 hover:text-neon-cyan transition-colors truncate w-28 text-left shrink-0"
                          onClick={() => handleCrossFilter('source_slug', r.name)}
                        >
                          {r.name}
                        </button>
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-neon-cyan rounded-full" style={{ width: `${Math.min(r.rate, 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-neon-cyan w-10 text-right shrink-0">{r.rate}%</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{r.approved}/{r.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {convByEvent.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">По событию</p>
                  <div className="space-y-1.5">
                    {convByEvent.map((r) => (
                      <div key={r.name} className="flex items-center gap-2">
                        <button
                          className="text-xs text-foreground/80 hover:text-neon-cyan transition-colors truncate w-28 text-left shrink-0"
                          onClick={() => handleCrossFilter('event', r.name)}
                        >
                          {r.name}
                        </button>
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-neon-cyan rounded-full" style={{ width: `${Math.min(r.rate, 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-neon-cyan w-10 text-right shrink-0">{r.rate}%</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{r.approved}/{r.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page wrapper with context ────────────────────────────────────────────────

function AnalyticsContent() {
  const searchParams = useSearchParams()
  const safeMode = searchParams.get('safe') === '1'
  return (
    <AnalyticsErrorBoundary>
      <AnalyticsProvider>
        <AnalyticsErrorBoundary>
          <AnalyticsInner safeMode={safeMode} />
        </AnalyticsErrorBoundary>
      </AnalyticsProvider>
    </AnalyticsErrorBoundary>
  )
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><LoadingSpinner /></div>}>
      <AnalyticsContent />
    </Suspense>
  )
}
