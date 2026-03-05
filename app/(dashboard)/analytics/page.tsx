'use client'

// Force server-side rendering on every request — never statically cached
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
  Legend,
} from 'recharts'
import { NeonCard } from '@/components/shared/NeonCard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { buildApiUrl } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

const NEON_COLORS = ['#00e5ff', '#00ff88', '#ffcc00', '#ff3355', '#cc44ff', '#4488ff']

type AnyRecord = Record<string, unknown>

interface AnalyticsData {
  leads: AnyRecord[]
  outcomes: AnyRecord[]
}

interface KpiData {
  leads_today?: number
  approved_today?: number
  shortlisted_today?: number
  rejected_today?: number
  [key: string]: unknown
}

interface DiagEntry {
  url: string
  status?: number
  statusText?: string
  responseText?: string
  count?: number
  keys?: string[]
}

/** Count by key; if key is missing on every row, skip nullish rows so the chart stays empty */
function countBy<T extends AnyRecord>(arr: T[], ...keys: string[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {}
  for (const item of arr) {
    // Try each candidate key in order; skip if all are nullish
    let v: string | undefined
    for (const k of keys) {
      if (item[k] != null && item[k] !== '') { v = String(item[k]); break }
    }
    if (!v) continue
    counts[v] = (counts[v] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name: name.slice(0, 20), value }))
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [diags, setDiags] = useState<DiagEntry[]>([])

  useEffect(() => {
    async function load() {
      const entries: DiagEntry[] = []
      try {
        const analyticsUrl = buildApiUrl('/api/sb/query', { name: 'lead_analytics' })
        const kpiUrl = buildApiUrl('/api/sb/query', { name: 'kpi_today' })
        const [analyticsRes, kpiRes] = await Promise.all([
          fetch(analyticsUrl, { cache: 'no-store' }),
          fetch(kpiUrl, { cache: 'no-store' }),
        ])

        if (!analyticsRes.ok) {
          const responseText = (await analyticsRes.text()).slice(0, 1000)
          entries.push({ url: analyticsUrl, status: analyticsRes.status, statusText: analyticsRes.statusText, responseText })
        } else {
          const analyticsJson = await analyticsRes.json()
          const data: AnalyticsData = analyticsJson.data
          setAnalytics(data)
          if (data) {
            const leads = data.leads ?? []
            entries.push({
              url: analyticsUrl,
              count: leads.length,
              keys: leads.length > 0 ? Object.keys(leads[0]) : [],
            })
          }
        }

        if (!kpiRes.ok) {
          const responseText = (await kpiRes.text()).slice(0, 500)
          entries.push({ url: kpiUrl, status: kpiRes.status, statusText: kpiRes.statusText, responseText })
        } else {
          const kpiJson = await kpiRes.json()
          setKpi(kpiJson.data)
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
  if (!analytics) {
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
        <EmptyState icon={BarChart3} title="Нет данных для аналитики" description="Проверьте подключение к Supabase и таблицу leads" />
      </div>
    )
  }
  if (analytics.leads.length === 0) {
    return (
      <div className="space-y-4">
        {diags.length > 0 && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 text-xs font-mono space-y-2">
            <p className="font-semibold text-yellow-400">⚑ Диагностика</p>
            {diags.map((d, i) => (
              <div key={i}>
                <p className="text-muted-foreground break-all">URL: {d.url}</p>
                <p className="text-yellow-400">Записей: {d.count ?? 0} — {d.keys?.length === 0 ? 'таблица leads пуста' : `поля: ${d.keys?.join(', ')}`}</p>
              </div>
            ))}
          </div>
        )}
        <EmptyState icon={BarChart3} title="Таблица leads пуста" description="Данных для отображения нет" />
      </div>
    )
  }

  const leads = analytics.leads ?? []
  const outcomes = analytics.outcomes ?? []

  // Funnel data
  const totalLeads = leads.length
  const approved = outcomes.filter((o) => o.outcome === 'approved').length
  const shortlisted = outcomes.filter((o) => o.outcome === 'shortlisted').length
  const rejected = outcomes.filter((o) => o.outcome === 'rejected').length

  const funnelData = [
    { name: 'Лиды', value: totalLeads || Number(kpi?.leads_today ?? 0), fill: '#00e5ff' },
    { name: 'Одобрено', value: approved || Number(kpi?.approved_today ?? 0), fill: '#00ff88' },
    { name: 'Шортлист', value: shortlisted || Number(kpi?.shortlisted_today ?? 0), fill: '#ffcc00' },
    { name: 'Отклонено', value: rejected || Number(kpi?.rejected_today ?? 0), fill: '#ff3355' },
  ].filter((d) => d.value > 0)

  // Sources — try source_slug first, then source as fallback
  const sourceData = countBy(leads, 'source_slug', 'source')

  // Warmth distribution
  const warmthData = countBy(leads, 'warmth').map((d, i) => ({
    ...d,
    fill: NEON_COLORS[i] ?? '#888',
  }))

  // Top domains
  const domainData = countBy(leads, 'domain')

  // Geo
  // countBy already skips nullish values, so no extra filter needed
  const geoData = countBy(leads, 'country')

  const tooltipStyle = {
    backgroundColor: 'hsl(220 15% 10%)',
    border: '1px solid hsl(220 15% 20%)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '12px',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Diagnostics block */}
      {diags.length > 0 && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 text-xs font-mono space-y-3">
          <p className="font-semibold text-yellow-400">⚑ Диагностика запросов</p>
          {diags.map((d, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-muted-foreground break-all">URL: {d.url}</p>
              {d.status !== undefined ? (
                <>
                  <p className="text-red-400">HTTP {d.status} {d.statusText}</p>
                  {d.responseText && (
                    <pre className="text-red-300 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                      {d.responseText}
                    </pre>
                  )}
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">Записей: {d.count}</p>
                  {d.keys && d.keys.length > 0 && (
                    <p className="text-muted-foreground">Поля: {d.keys.join(', ')}</p>
                  )}
                  {d.keys && d.keys.length === 0 && (
                    <p className="text-yellow-400">Массив пустой — нет данных в таблице leads</p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Funnel */}
      <NeonCard>
        <h3 className="text-sm font-semibold mb-4">Воронка лидов</h3>
        {funnelData.length === 0 ? (
          <EmptyState title="Нет данных воронки" description="Начните обрабатывать лиды в инбоксе" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <FunnelChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="right" fill="#fff" stroke="none" dataKey="name" className="text-xs" />
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        )}
      </NeonCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By source */}
        <NeonCard>
          <h3 className="text-sm font-semibold mb-4">Лиды по источнику</h3>
          {sourceData.length === 0 ? (
            <EmptyState title="Нет данных" description="Нет лидов с заполненным source_slug" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sourceData} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#888', fontSize: 10 }}
                  width={90}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#00e5ff" radius={[0, 4, 4, 0]}>
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </NeonCard>

        {/* Warmth distribution */}
        <NeonCard>
          <h3 className="text-sm font-semibold mb-4">Распределение по интенту</h3>
          {warmthData.length === 0 ? (
            <EmptyState title="Нет данных" description="Нет лидов с заполненным warmth" />
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

        {/* Top domains */}
        <NeonCard>
          <h3 className="text-sm font-semibold mb-4">Топ доменов</h3>
          {domainData.length === 0 ? (
            <EmptyState title="Нет данных" description="Поле domain отсутствует" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={domainData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#888', fontSize: 10 }}
                  width={100}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#00ff88" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </NeonCard>

        {/* Geo */}
        <NeonCard>
          <h3 className="text-sm font-semibold mb-4">География лидов</h3>
          {geoData.length === 0 ? (
            <EmptyState title="Нет данных" description="Поле country/geo отсутствует в лидах" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={geoData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#888', fontSize: 10 }}
                  width={80}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#cc44ff" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </NeonCard>
      </div>
    </div>
  )
}
