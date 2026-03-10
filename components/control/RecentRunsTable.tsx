'use client'

import { useEffect, useState, useCallback } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusDot } from '@/components/shared/StatusDot'
import { Button } from '@/components/ui/button'
import { normaliseRun, type NormalisedRun } from '@/lib/field-resolver'
import { formatDateTime, formatRelative, buildApiUrl, truncate } from '@/lib/utils'
import { Copy, RefreshCw, Activity } from 'lucide-react'
import { toast } from 'sonner'

type AnyRecord = Record<string, unknown>

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

interface Props {
  refreshTrigger?: number
}

export function RecentRunsTable({ refreshTrigger }: Props) {
  const [runs, setRuns] = useState<RunUnified[]>([])
  const [errors, setErrors] = useState<AnyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'runs' | 'errors'>('runs')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [runsRes, errRes] = await Promise.all([
        fetch(buildApiUrl('/api/sb/query', { name: 'runs_unified', limit: '200' })),
        fetch(buildApiUrl('/api/sb/query', { name: 'recent_errors' })),
      ])
      const runsJson = await runsRes.json()
      const errJson = await errRes.json()
      setRuns(runsJson.data ?? [])
      setErrors(errJson.data ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshTrigger])

  function copyLogs() {
    const text = errors
      .map((e) => `[${e.created_at ?? ''}] ${e.status ?? ''} | ${e.error ?? e.error_message ?? ''}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    toast.success('Логи скопированы в буфер обмена')
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {([['runs', 'Прогоны'], ['errors', 'Ошибки']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                tab === key
                  ? 'border-neon-cyan/50 text-neon-cyan bg-neon-cyan/5'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {key === 'errors' && errors.length > 0 && (
                <span className="ml-1.5 text-neon-red">{errors.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {tab === 'errors' && errors.length > 0 && (
            <Button variant="ghost" size="sm" onClick={copyLogs} className="text-xs gap-1.5 h-7">
              <Copy className="w-3 h-3" /> Копировать
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={load} className="text-xs gap-1.5 h-7">
            <RefreshCw className="w-3 h-3" /> Обновить
          </Button>
        </div>
      </div>

      {tab === 'runs' && (
        runs.length === 0 ? (
          <EmptyState icon={Activity} title="Нет прогонов" description="История прогонов появится здесь" />
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="border-b border-border bg-secondary/60">
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Функция</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium w-28">Статус</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Ошибка</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium w-24">Вх / Вых</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium w-20">Когда</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, i) => (
                    <tr
                      key={`${run.id}-${i}`}
                      className="border-b border-border/40 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="px-3 py-2 text-foreground">
                        <div className="font-medium">{run.functionLabelRu}</div>
                        {run.source_label && (
                          <div className="text-muted-foreground/50 font-mono text-[10px]">{truncate(run.source_label, 30)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <StatusDot status={run.statusVariant} />
                          <span>{run.statusRu}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        {run.errorRu ? (
                          <span className="text-neon-red/80 truncate block" title={run.error_text ?? run.errorRu}>
                            {run.errorRu}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {run.count_in != null || run.count_out != null
                          ? `${run.count_in ?? '—'} / ${run.count_out ?? '—'}`
                          : '—'
                        }
                      </td>
                      <td className="px-3 py-2 text-muted-foreground" title={formatDateTime(run.created_at)}>
                        {formatRelative(run.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {tab === 'errors' && (
        errors.length === 0 ? (
          <EmptyState title="Ошибок нет" description="За последние 24ч ошибок не обнаружено" />
        ) : (
          <div className="border border-neon-red/20 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="border-b border-border bg-secondary/60">
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Функция / Тип</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Сообщение</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium w-28">Время</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((err, i) => {
                    const r = normaliseRun(err)
                    return (
                      <tr key={i} className="border-b border-border/40 hover:bg-secondary/20">
                        <td className="px-3 py-2 font-mono text-neon-red/70">
                          {truncate(r.name ?? String(r.id), 35) || '—'}
                        </td>
                        <td className="px-3 py-2 text-foreground/70 max-w-[300px]" title={r.error}>
                          {truncate(r.error, 100) || '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatRelative(r.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
