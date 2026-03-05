'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
import { AnalyticsProvider, useAnalytics, DEFAULT_CHART_CONFIGS, DEFAULT_LAYOUT, type ChartConfig } from '@/lib/analytics/context'
import { AnalyticsErrorBoundary } from '@/components/analytics/ErrorBoundary'
import { buildApiUrl } from '@/lib/utils'
import { BarChart3, RefreshCw, Sun, Moon, Zap } from 'lucide-react'

const NEON_COLORS = ['#00e5ff', '#00ff88', '#ffcc00', '#ff3355', '#cc44ff', '#4488ff', '#ff9900', '#44ffcc']

type RollupRow = Record<string, unknown>
type KpiRow = Record<string, unknown>
type Period = 'today' | '7d' | '30d' | '90d' | 'custom'

const PERIOD_OPTIONS: { key: Period; label: string; days: number }[] = [
  { key: 'today', label: 'Сегодня', days: 1 },
  { key: '7d', label: '7 дн.', days: 7 },
  { key: '30d', label: '30 дн.', days: 30 },
  { key: '90d', label: '90 дн.', days: 90 },
  { key: 'custom', label: 'Свой', days: 0 },
]

const tooltipStyle = {
  backgroundColor: '#0d1117',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px',
  color: '#f0f4f8',
  fontSize: '12px',
}
const labelStyle = { color: '#f0f4f8' }
const itemStyle = { color: '#f0f4f8' }

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
    <text x={x} y={y} fill="#e2e8f0" fontSize={10} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
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
          <Legend formatter={(v) => <span style={{ color: '#d1d5db', fontSize: 11 }}>{v}</span>} />
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

function AnalyticsInner() {
  const { state, dispatch } = useAnalytics()
  const [allRows, setAllRows] = useState<RollupRow[] | null>(null)
  const [kpi, setKpi] = useState<KpiRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Drag & drop state for chart card reordering
  const [dragId, setDragId] = useState<string | null>(null)
  const layout = state.layout?.length ? state.layout : DEFAULT_LAYOUT

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
      dispatch({ type: 'TOGGLE_FILTER', payload: { dimension, value } })
    },
    [dispatch]
  )

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
        const kpiUrl = buildApiUrl('/api/sb/query', { name: 'kpi_today_counts' })
        const [rollupRes, kpiRes] = await Promise.all([
          fetch(rollupUrl, { cache: 'no-store' }),
          fetch(kpiUrl, { cache: 'no-store' }),
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
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        {periodBar}
        <div className="flex items-center gap-2 flex-wrap">
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
          <AiPanel rows={rows} />
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

      {/* Configurable charts — drag&drop reorderable */}
      <div className="space-y-4">
        {layout.map((chartId) => {
          const defaultCfg = DEFAULT_CHART_CONFIGS[chartId]
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
                distinctValues={getDistinctValues(state.chartConfig[chartId]?.groupBy ?? defaultCfg.groupBy)}
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
    </div>
  )
}

// ─── Page wrapper with context ────────────────────────────────────────────────

export default function AnalyticsPage() {
  return (
    <AnalyticsErrorBoundary>
      <AnalyticsProvider>
        <AnalyticsErrorBoundary>
          <AnalyticsInner />
        </AnalyticsErrorBoundary>
      </AnalyticsProvider>
    </AnalyticsErrorBoundary>
  )
}
