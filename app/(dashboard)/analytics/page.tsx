'use client'

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

function countBy<T extends AnyRecord>(arr: T[], key: string): { name: string; value: number }[] {
  const counts: Record<string, number> = {}
  for (const item of arr) {
    const v = String(item[key] ?? 'Неизвестно')
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

  useEffect(() => {
    async function load() {
      try {
        const [analyticsRes, kpiRes] = await Promise.all([
          fetch(buildApiUrl('/api/sb/query', { name: 'lead_analytics' })),
          fetch(buildApiUrl('/api/sb/query', { name: 'kpi_today' })),
        ])
        const analyticsJson = await analyticsRes.json()
        const kpiJson = await kpiRes.json()
        setAnalytics(analyticsJson.data)
        setKpi(kpiJson.data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />
  if (!analytics) return <EmptyState icon={BarChart3} title="Нет данных для аналитики" />

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

  // Sources
  const sourceData = countBy(leads, 'source_slug')

  // Warmth distribution
  const warmthData = countBy(leads, 'warmth').map((d, i) => ({
    ...d,
    fill: NEON_COLORS[i] ?? '#888',
  }))

  // Top domains
  const domainData = countBy(leads, 'domain')

  // Geo
  const geoData = countBy(leads, 'country').filter((d) => d.name !== 'Неизвестно' && d.name !== 'undefined')

  const tooltipStyle = {
    backgroundColor: 'hsl(220 15% 10%)',
    border: '1px solid hsl(220 15% 20%)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '12px',
  }

  return (
    <div className="space-y-6 animate-fade-in">
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
