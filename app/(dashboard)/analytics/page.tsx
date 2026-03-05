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
import { buildApiUrl } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

const NEON_COLORS = ['#00e5ff', '#00ff88', '#ffcc00', '#ff3355', '#cc44ff', '#4488ff']

type RollupRow = Record<string, unknown>
type KpiRow = Record<string, unknown>

interface DiagEntry {
  url: string
  status?: number
  statusText?: string
  responseText?: string
  count?: number
  keys?: string[]
}

const tooltipStyle = {
  backgroundColor: 'hsl(220 15% 10%)',
  border: '1px solid hsl(220 15% 20%)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '12px',
}

/** Sum `valueKey` grouped by `groupKey`, top 12 descending */
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

/** Daily time-series: sum leads_cnt + weighted avg_score, last 30 days */
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
    .slice(-30)
    .map(([day, v]) => ({
      name: day.slice(5),   // "MM-DD"
      leads: v.leads,
      score: v.n > 0 ? Math.round(v.scoreSum / v.n) : 0,
    }))
}

/** Pick first non-null value from kpi row using multiple candidate keys */
function kpiVal(row: KpiRow, ...keys: string[]): number {
  for (const k of keys) {
    const v = Number(row[k] ?? NaN)
    if (!isNaN(v) && v > 0) return v
  }
  return 0
}

export default function AnalyticsPage() {
  const [rollup, setRollup] = useState<RollupRow[] | null>(null)
  const [kpi, setKpi] = useState<KpiRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [diags, setDiags] = useState<DiagEntry[]>([])

  useEffect(() => {
    async function load() {
      const entries: DiagEntry[] = []
      try {
        const rollupUrl = buildApiUrl('/api/sb/query', { name: 'lead_analytics_rollup', limit: '90' })
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
          setRollup(rows)
          entries.push({
            url: rollupUrl,
            count: rows.length,
            keys: rows.length > 0 ? Object.keys(rows[0]) : [],
          })
        }

        if (!kpiRes.ok) {
          entries.push({ url: kpiUrl, status: kpiRes.status, statusText: kpiRes.statusText })
        } else {
          const json = await kpiRes.json()
          setKpi(json.data ?? null)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setDiags(entries)
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />

  // API error — rollup fetch failed
  if (rollup === null) {
    return (
      <div className="space-y-4">
        {diags.length > 0 && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs font-mono space-y-2">
            <p className="font-semibold text-red-400">✗ Ошибка загрузки аналитики</p>
            {diags.map((d, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-muted-foreground break-all">URL: {d.url}</p>
                {d.status !== undefined && <p className="text-red-400">HTTP {d.status} {d.statusText}</p>}
                {d.responseText && (
                  <pre className="text-red-300 whitespace-pre-wrap break-all max-h-40 overflow-auto">{d.responseText}</pre>
                )}
              </div>
            ))}
          </div>
        )}
        <EmptyState icon={BarChart3} title="Нет данных для аналитики" description="Проверьте подключение к Supabase и витрину lead_analytics_rollup" />
      </div>
    )
  }

  // Empty rollup
  if (rollup.length === 0) {
    return (
      <div className="space-y-4">
        {diags.length > 0 && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 text-xs font-mono space-y-2">
            <p className="font-semibold text-yellow-400">⚑ Диагностика</p>
            {diags.map((d, i) => (
              <div key={i}>
                <p className="text-muted-foreground break-all">URL: {d.url}</p>
                <p className="text-yellow-400">
                  Записей: {d.count ?? 0}{d.keys?.length === 0 ? ' — витрина пуста' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
        <EmptyState icon={BarChart3} title="Витрина lead_analytics_rollup пуста" description="Нет агрегированных данных за последние 90 дней" />
      </div>
    )
  }

  // Derived data
  const daily = dailySeries(rollup)
  const sourceData = aggBy(rollup, 'source_slug')
  const warmthData = aggBy(rollup, 'warmth').map((d, i) => ({ ...d, fill: NEON_COLORS[i] ?? '#888' }))
  const totalLeads = rollup.reduce((s, r) => s + Number(r['leads_cnt'] ?? 0), 0)

  const kpiCards = kpi
    ? [
        { label: 'Лиды (всего)', value: totalLeads },
        { label: 'Лиды сегодня', value: kpiVal(kpi, 'leads_today', 'leads_cnt_today') },
        { label: 'Одобрено', value: kpiVal(kpi, 'approved_today', 'approved_cnt') },
        { label: 'Отклонено', value: kpiVal(kpi, 'rejected_today', 'rejected_cnt') },
      ].filter((c) => c.value > 0)
    : [{ label: 'Лиды (всего)', value: totalLeads }]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Diagnostics */}
      {diags.length > 0 && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 text-xs font-mono space-y-2">
          <p className="font-semibold text-yellow-400">⚑ Диагностика</p>
          {diags.map((d, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-muted-foreground break-all">URL: {d.url}</p>
              {d.status !== undefined ? (
                <p className="text-red-400">HTTP {d.status} {d.statusText}</p>
              ) : (
                <p className="text-muted-foreground">
                  Записей: {d.count}
                  {d.keys && d.keys.length > 0 ? ` · поля: ${d.keys.join(', ')}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiCards.map((c) => (
          <NeonCard key={c.label} className="text-center py-3">
            <div className="text-2xl font-bold font-mono text-neon-cyan">{c.value.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{c.label}</div>
          </NeonCard>
        ))}
      </div>

      {/* Leads per day */}
      {daily.length > 0 && (
        <NeonCard>
          <h3 className="text-sm font-semibold mb-4">Лиды по дням</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
              <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 10 }} />
              <YAxis tick={{ fill: '#666', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="leads" name="Лиды" fill="#00e5ff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </NeonCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By source */}
        <NeonCard>
          <h3 className="text-sm font-semibold mb-4">Лиды по источнику</h3>
          {sourceData.length === 0 ? (
            <EmptyState title="Нет данных" description="source_slug отсутствует в витрине" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sourceData} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#888', fontSize: 10 }} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Лиды" fill="#00e5ff" radius={[0, 4, 4, 0]}>
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </NeonCard>

        {/* By warmth */}
        <NeonCard>
          <h3 className="text-sm font-semibold mb-4">По интенту (warmth)</h3>
          {warmthData.length === 0 ? (
            <EmptyState title="Нет данных" description="warmth отсутствует в витрине" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={warmthData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {warmthData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend formatter={(v) => <span style={{ color: '#aaa', fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </NeonCard>
      </div>

      {/* Score trend — only shown if rollup has avg_score */}
      {daily.some((d) => d.score > 0) && (
        <NeonCard>
          <h3 className="text-sm font-semibold mb-4">Средний скоринг по дням</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={daily} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
              <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#666', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="score" name="Avg Score" stroke="#00ff88" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </NeonCard>
      )}
    </div>
  )
}
