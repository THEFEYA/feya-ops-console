'use client'

import { useEffect, useState } from 'react'
import { NeonCard } from '@/components/shared/NeonCard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatRelative, buildApiUrl } from '@/lib/utils'
import { TrendingUp, ListTodo, AlertTriangle, Clock } from 'lucide-react'

interface KpiData {
  leads_today?: number
  tasks_open?: number
  errors_24h?: number
  last_run_at?: string
  [key: string]: unknown
}

interface TaskStats {
  open?: number
  queued?: number
  error?: number
  failed?: number
}

interface RunsData {
  created_at?: string
}

export function KpiCards() {
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [taskStats, setTaskStats] = useState<TaskStats>({})
  const [lastRun, setLastRun] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [kpiRes, taskRes, runsRes] = await Promise.all([
          fetch(buildApiUrl('/api/sb/query', { name: 'kpi_today' })),
          fetch(buildApiUrl('/api/sb/query', { name: 'tasks_stats' })),
          fetch(buildApiUrl('/api/sb/query', { name: 'runs_recent', limit: '1' })),
        ])
        const kpiJson = await kpiRes.json()
        const taskJson = await taskRes.json()
        const runsJson = await runsRes.json()

        setKpi(kpiJson.data ?? {})
        setTaskStats(taskJson.data ?? {})
        const runs: RunsData[] = runsJson.data ?? []
        setLastRun(runs[0]?.created_at)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingSpinner />

  const openTasks = (taskStats.open ?? 0) + (taskStats.queued ?? 0)
  const errors = (taskStats.error ?? 0) + (taskStats.failed ?? 0)

  const cards = [
    {
      label: 'Лиды за сегодня',
      value: kpi?.leads_today ?? kpi?.leads_count ?? '—',
      icon: TrendingUp,
      glow: 'green' as const,
      hint: 'Лиды, собранные за текущие сутки',
    },
    {
      label: 'Открытые задачи',
      value: openTasks || (kpi?.tasks_open ?? '—'),
      icon: ListTodo,
      glow: 'cyan' as const,
      hint: 'Задачи со статусом open/queued',
    },
    {
      label: 'Ошибки за 24ч',
      value: errors || (kpi?.errors_24h ?? 0),
      icon: AlertTriangle,
      glow: errors > 0 ? 'red' as const : 'none' as const,
      hint: 'Задачи и прогоны с ошибкой за последние 24 часа',
    },
    {
      label: 'Последний прогон',
      value: formatRelative(lastRun ?? String(kpi?.last_run_at ?? '')),
      icon: Clock,
      glow: 'none' as const,
      hint: 'Время последнего выполненного прогона',
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((c) => (
        <NeonCard key={c.label} glow={c.glow} className="group" >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground" title={c.hint}>
              {c.label}
            </p>
            <c.icon className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground/70 transition-colors" />
          </div>
          <p className="text-3xl font-bold tabular-nums">{String(c.value)}</p>
        </NeonCard>
      ))}
    </div>
  )
}
