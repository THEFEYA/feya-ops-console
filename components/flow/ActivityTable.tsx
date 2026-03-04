'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusDot } from '@/components/shared/StatusDot'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatRelative, buildApiUrl, truncate } from '@/lib/utils'
import { normaliseRun, type NormalisedRun } from '@/lib/field-resolver'
import { Activity } from 'lucide-react'

interface Props {
  filterNode?: string | null
}

type AnyRecord = Record<string, unknown>

export function ActivityTable({ filterNode }: Props) {
  const [runs, setRuns] = useState<NormalisedRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(buildApiUrl('/api/sb/query', { name: 'runs_recent', limit: '200' }))
        const json = await res.json()
        const all: NormalisedRun[] = (json.data ?? []).map((r: AnyRecord) => normaliseRun(r))
        setRuns(all)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 20000)
    return () => clearInterval(id)
  }, [])

  const filtered = filterNode
    ? runs.filter((r) =>
        String(r.node ?? r.name ?? '').toLowerCase().includes(filterNode.toLowerCase())
      )
    : runs

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
        Последние события {filterNode && <span className="text-neon-cyan">· {filterNode}</span>}
      </h2>

      {filtered.length === 0 ? (
        <EmptyState icon={Activity} title="Нет событий" description="Прогоны и задачи появятся здесь" />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Функция</th>
                  <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Статус</th>
                  <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Ошибка</th>
                  <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Время</th>
                  <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Когда</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((run, i) => (
                  <tr
                    key={`${run.id}-${i}`}
                    className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">
                      {truncate(run.name ?? String(run.id), 40) || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {run.status ? (
                        <div className="flex items-center gap-1.5">
                          <StatusDot status={run.status} />
                          <span className="text-xs">{run.status}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      {run.error ? (
                        <span className="text-xs text-neon-red/80 truncate block" title={run.error}>
                          {truncate(run.error, 60)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                      {run.duration_ms ? `${run.duration_ms}ms` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground" title={formatDateTime(run.created_at)}>
                      {formatRelative(run.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
