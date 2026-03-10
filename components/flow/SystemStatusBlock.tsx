'use client'

import { useEffect, useState } from 'react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusDot } from '@/components/shared/StatusDot'
import { buildApiUrl, formatRelative } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

interface FunctionHealth {
  functionId:      string
  functionLabelRu: string
  groupRu:         string
  lastRunAt:       string | null
  lastStatus:      string | null
  lastStatusRu:    string
  statusVariant:   'ok' | 'error' | 'running' | 'warn' | 'idle'
  errors24h:       number
  lastError:       string | null
  lastCountIn:     number | null
  lastCountOut:    number | null
}

interface SystemStatus {
  functions: FunctionHealth[]
  summary: {
    ok:          number
    attention:   number
    errors24h:   number
    lastActivityAt: string | null
  }
}

export function SystemStatusBlock() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(buildApiUrl('/api/sb/query', { name: 'system_status' }))
        const json = await res.json()
        if (json.data) setStatus(json.data as SystemStatus)
      } catch (e) {
        console.error('[SystemStatusBlock]', e)
      } finally {
        setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingSpinner />
  if (!status || status.functions.length === 0) return null

  const { summary } = status
  const hasAttention = summary.attention > 0 || summary.errors24h > 0

  return (
    <div className="space-y-3">
      {/* Summary strip */}
      <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg border border-border bg-secondary/30 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-neon-green" />
          <span className="text-muted-foreground">Работает:</span>
          <span className="font-semibold text-neon-green">{summary.ok}</span>
        </div>
        {hasAttention && (
          <div className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-neon-yellow" />
            <span className="text-muted-foreground">Требует внимания:</span>
            <span className="font-semibold text-neon-yellow">{summary.attention}</span>
          </div>
        )}
        {summary.errors24h > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-neon-red" />
            <span className="text-muted-foreground">Ошибок за 24ч:</span>
            <span className="font-semibold text-neon-red">{summary.errors24h}</span>
          </div>
        )}
        {summary.lastActivityAt && (
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Последняя активность: {formatRelative(summary.lastActivityAt)}</span>
          </div>
        )}
      </div>

      {/* Per-function cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {status.functions.map((fn) => (
          <div
            key={fn.functionId}
            className={`px-3 py-2.5 rounded-lg border text-xs transition-colors ${
              fn.statusVariant === 'error'
                ? 'border-neon-red/40 bg-neon-red/5'
                : fn.statusVariant === 'warn'
                ? 'border-neon-yellow/40 bg-neon-yellow/5'
                : fn.statusVariant === 'ok'
                ? 'border-neon-green/20 bg-neon-green/3'
                : 'border-border bg-secondary/20'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-medium text-foreground leading-tight">{fn.functionLabelRu}</span>
              <StatusDot status={fn.statusVariant} />
            </div>
            <div className="text-muted-foreground text-[11px] space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span>{fn.lastStatusRu}</span>
                {fn.lastRunAt && (
                  <span>{formatRelative(fn.lastRunAt)}</span>
                )}
              </div>
              {fn.lastError && (
                <div className="text-neon-red/70 truncate" title={fn.lastError}>
                  {fn.lastError}
                </div>
              )}
              {(fn.lastCountIn != null || fn.lastCountOut != null) && (
                <div className="flex gap-2 text-muted-foreground/70">
                  {fn.lastCountIn != null && <span>вход: {fn.lastCountIn}</span>}
                  {fn.lastCountOut != null && <span>выход: {fn.lastCountOut}</span>}
                </div>
              )}
              {fn.errors24h > 0 && (
                <div className="text-neon-red/60">{fn.errors24h} ош. за 24ч</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
