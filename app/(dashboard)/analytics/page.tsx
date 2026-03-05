'use client'

// Force server-side rendering on every request — never statically cached
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { NeonCard } from '@/components/shared/NeonCard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { PivotTable } from '@/components/analytics/PivotTable'
import { buildApiUrl } from '@/lib/utils'
import { BarChart3, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

const NEON_COLORS = ['#00e5ff', '#00ff88', '#ffcc00', '#ff3355', '#cc44ff', '#4488ff']

type RollupRow = Record<string, unknown>
type KpiRow = Record<string, unknown>
type Period = 'today' | '7d' | '30d' | '90d' | 'custom'

interface DiagEntry {
  url: string
  status?: number
  statusText?: string
  responseText?: string
  count?: number
  keys?: string[]
}

const PERIOD_OPTIONS: { key: Period; label: string; days: number }[] = [
  { key: 'today', label: 'Сегодня', days: 1 },
  { key: '7d', label: '7 дн.', days: 7 },
  { key: '30d', label: '30 дн.', days: 30 },
  { key: '90d', label: '90 дн.', days: 90 },
  { key: 'custom', label: 'Свой', days: 0 },
]

// High-contrast tooltip style for dark background
const tooltipStyle = {
  backgroundColor: '#0d1117',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px',
  color: '#f0f4f8',
  fontSize: '12px',
}
const labelStyle = { color: '#f0f4f8' }

function aggBy(rows: RollupRow[], groupKey: string, valueKey = 'leads_cnt'): { name: string; value: number }[] {
  const sums: Record<string, number> = {}
  for (const row of rows) {
    const k = String(row[groupKey] ?? '').trim()
    if (!k) continue
    sums[k] = (sums[k] ?? 0) + Number(row[valueKey] ?? 0)
  }
  return Object.entries(sums)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, value]) => ({ name: name.slice(0, 20), value: Math.round(value * 10) / 10 }))
}

function dailySeries(rows: RollupRow[]): { name: string; leads: number; score: number }[] {
  const byDay: Record<string, { leads: number; scoreSum: number; n: number }> = {}
  for (const row of rows) {
    const day = String(row['day'] ?? '').slice(0, 10)
    if (!day) continue
    const cnt = Number(row['leads_cnt'] ?? 0)
    const sc = Number(row['avg_score'] ?? 0)
    if (!byDay[day]) byDay[day] = { leads: 0, scoreSum: 0, n: 0 }
    byDay[day].leads += cnt
    byDay[day].scoreSum += sc * cnt
    byDay[day].n += cnt
  }
  return Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({
      name: day.slice(5),
      leads: v.leads,
      score: v.n > 0 ? Math.round(v.scoreSum / v.n) : 0,
    }))
}

function kpiVal(row: KpiRow, ...keys: string[]): number {
  for (const k of keys) {
    const v = Number(row[k] ?? NaN)
    if (!isNaN(v) && v > 0) return v
  }
  return 0
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

// Pie chart label rendered as SVG text for contrast
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
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

interface SectionProps {
  id: string
  title: string
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}
function Section({ title, collapsed, onToggle, children }: SectionProps) {
  return (
    <NeonCard>
      <div className="flex items-center justify-between cursor-pointer select-none" onClick={onToggle}>
        <h3 className="text-sm font-semibold">{title}</h3>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
          : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </div>
      {!collapsed && <div className="mt-4">{children}</div>}
    </NeonCard>
  )
}

export default function AnalyticsPage() {
  const [rollup, setRollup] = useState<RollupRow[] | null>(null)
  const [kpi, setKpi] = useState<KpiRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [diags, setDiags] = useState<DiagEntry[]>([])
  const [period, setPeriod] = useState<Period>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggleSection(id: string) {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }))
  }

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const entries: DiagEntry[] = []
      try {
        const pParams = getPeriodParams(period, customFrom, customTo)
        const rollupUrl = buildApiUrl('/api/sb/query', { name: 'lead_analytics_rollup', ...pParams })
        const kpiUrl = buildApiUrl('/api/sb/query', { name: 'kpi_today_counts' })
        const [rollupRes, kpiRes] = await Promise.all([
          fetch(rollupUrl, { cache: 'no-store' }),
          fetch(kpiUrl, { cache: 'no-store' }),
        ])

        if (!rollupRes.ok) {
          const responseText = (await rollupRes.text()).slice(0, 1000)
          entries.push({ url: rollupUrl, status: rollupRes.status, statusText: rollupRes.statusText, responseText })
        } else {
          const json = await rollupRes.json()
          const rows: RollupRow[] = json.data ?? []
          if (!cancelled) setRollup(rows)
          entries.push({ url: rollupUrl, count: rows.length, keys: rows.length > 0 ? Object.keys(rows[0]) : [] })
        }

        if (kpiRes.ok) {
          const json = await kpiRes.json()
          if (!cancelled) setKpi(json.data ?? null)
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) { setDiags(entries); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [period, customFrom, customTo])

  // Period selector bar
  const periodBar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-border overflow-hidden text-xs">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setPeriod(opt.key)}
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

  if (loading && rollup === null) return (
    <div className="space-y-4">
      {periodBar}
      <LoadingSpinner />
    </div>
  )

  if (rollup === null) {
    return (
      <div className="space-y-4">
        {periodBar}
        {diags.length > 0 && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs font-mono space-y-2">
            <p className="font-semibold text-red-400">✗ Ошибка загрузки аналитики</p>
            {diags.map((d, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-muted-foreground break-all">URL: {d.url}</p>
                {d.status !== undefined && <p className="text-red-400">HTTP {d.status} {d.statusText}</p>}
                {d.responseText && <pre className="text-red-300 whitespace-pre-wrap break-all max-h-40 overflow-auto">{d.responseText}</pre>}
              </div>
            ))}
          </div>
        )}
        <EmptyState icon={BarChart3} title="Нет данных" description="Проверьте витрину lead_analytics_rollup" />
      </div>
    )
  }

  if (rollup.length === 0) {
    return (
      <div className="space-y-4">
        {periodBar}
        <EmptyState icon={BarChart3} title="Данных за период нет" description="Попробуйте расширить диапазон дат" />
      </div>
    )
  }

  const daily = dailySeries(rollup)
  const sourceData = aggBy(rollup, 'source_slug')
  const warmthData = aggBy(rollup, 'warmth').map((d, i) => ({ ...d, fill: NEON_COLORS[i] ?? '#888' }))
  const totalLeads = rollup.reduce((s, r) => s + Number(r['leads_cnt'] ?? 0), 0)

  const kpiCards = [
    { label: 'Лиды (период)', value: totalLeads },
    kpi ? { label: 'Лиды сегодня', value: kpiVal(kpi, 'leads_today', 'leads_cnt_today') } : null,
    kpi ? { label: 'Одобрено', value: kpiVal(kpi, 'approved_today', 'approved_cnt') } : null,
    kpi ? { label: 'Отклонено', value: kpiVal(kpi, 'rejected_today', 'rejected_cnt') } : null,
  ].filter((c): c is { label: string; value: number } => c !== null && c.value > 0)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Period selector */}
      {periodBar}

      {/* Diagnostics (collapsed by default once data arrives) */}
      {diags.length > 0 && (
        <Section id="diag" title="⚑ Диагностика" collapsed={!!collapsed['diag']} onToggle={() => toggleSection('diag')}>
          {diags.map((d, i) => (
            <div key={i} className="text-xs font-mono space-y-0.5">
              <p className="text-muted-foreground break-all">URL: {d.url}</p>
              {d.status !== undefined
                ? <p className="text-red-400">HTTP {d.status} {d.statusText}</p>
                : <p className="text-muted-foreground">Записей: {d.count}{d.keys?.length ? ` · поля: ${d.keys.join(', ')}` : ''}</p>
              }
            </div>
          ))}
        </Section>
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

      {/* Leads per day */}
      <Section id="daily" title="Лиды по дням" collapsed={!!collapsed['daily']} onToggle={() => toggleSection('daily')}>
        {daily.length === 0
          ? <p className="text-xs text-muted-foreground">Нет данных с полем «day» в витрине</p>
          : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={{ color: '#f0f4f8' }} />
                <Bar dataKey="leads" name="Лиды" fill="#00e5ff" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By source */}
        <Section id="source" title="Лиды по источнику" collapsed={!!collapsed['source']} onToggle={() => toggleSection('source')}>
          {sourceData.length === 0
            ? <EmptyState title="Нет данных" description="source_slug отсутствует в витрине" />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sourceData} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={90} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={{ color: '#f0f4f8' }} />
                  <Bar dataKey="value" name="Лиды" fill="#00e5ff" radius={[0, 4, 4, 0]}>
                    {sourceData.map((_, i) => <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
        </Section>

        {/* By warmth */}
        <Section id="warmth" title="По интенту (warmth)" collapsed={!!collapsed['warmth']} onToggle={() => toggleSection('warmth')}>
          {warmthData.length === 0
            ? <EmptyState title="Нет данных" description="warmth отсутствует в витрине" />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={warmthData}
                    cx="50%"
                    cy="50%"
                    outerRadius={72}
                    dataKey="value"
                    labelLine={false}
                    label={PieLabel as unknown as boolean}
                  >
                    {warmthData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#f0f4f8' }} />
                  <Legend formatter={(v) => <span style={{ color: '#d1d5db', fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
        </Section>
      </div>

      {/* Score trend */}
      {daily.some((d) => d.score > 0) && (
        <Section id="score" title="Средний скоринг по дням" collapsed={!!collapsed['score']} onToggle={() => toggleSection('score')}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={daily} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={{ color: '#f0f4f8' }} />
              <Line type="monotone" dataKey="score" name="Avg Score" stroke="#00ff88" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* Pivot table */}
      <Section id="pivot" title="Сводная таблица" collapsed={!!collapsed['pivot']} onToggle={() => toggleSection('pivot')}>
        <PivotTable rows={rollup} />
      </Section>
    </div>
  )
}
