'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusDot } from '@/components/shared/StatusDot'
import { formatDateTime, formatRelative, buildApiUrl, truncate } from '@/lib/utils'
import { Activity } from 'lucide-react'

interface Props {
  filterNode?: string | null
}

interface RunUnified {
  id:              string
  functionId:      string
  functionLabelRu: string
  status:          string | null
  statusRu:        string
  statusVariant:   'ok' | 'error' | 'running' | 'warn' | 'idle'
  created_at:      string | null
  error_text:      string | null
  errorRu:         string | null
  count_in:        number | null
  count_out:       number | null
  source_label:    string | null
  source_table:    string
}

export function ActivityTable({ filterNode }: Props) {
  const [runs, setRuns] = useState<RunUnified[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(buildApiUrl('/api/sb/query', { name: 'runs_unified', limit: '200' }))
        const json = await res.json()
        setRuns(json.data ?? [])
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
        r.functionLabelRu.toLowerCase().includes(filterNode.toLowerCase()) ||
        r.functionId.toLowerCase().includes(filterNode.toLowerCase())
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
                  <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Вход / Выход</th>
                  <th className="px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Когда</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((run, i) => (
                  <tr
                    key={`${run.id}-${i}`}
                    className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs text-foreground">
                      <div className="font-medium">{run.functionLabelRu}</div>
                      {run.source_label && (
                        <div className="text-muted-foreground/60 font-mono">{truncate(run.source_label, 30)}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={run.statusVariant} />
                        <span className="text-xs">{run.statusRu}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      {run.errorRu ? (
                        <span className="text-xs text-neon-red/80 truncate block" title={run.error_text ?? run.errorRu}>
                          {run.errorRu}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {run.count_in != null || run.count_out != null ? (
                        <span>
                          {run.count_in ?? '—'} → {run.count_out ?? '—'}
                        </span>
                      ) : '—'}
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
