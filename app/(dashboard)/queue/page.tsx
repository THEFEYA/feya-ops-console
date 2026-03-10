'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertCircle, Clock, MessageSquare, Inbox, CheckCircle2, RefreshCw } from 'lucide-react'
import { LeadDetailPanel } from '@/components/inbox/LeadDetailPanel'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { type NormalisedLead } from '@/lib/field-resolver'
import { type Stage, STAGE_LABEL_RU, stageVariant } from '@/lib/domain/stage'
import { ACTION_TYPE_RU, type ActionType } from '@/lib/api/leadActions'
import { buildApiUrl, formatDateTime } from '@/lib/utils'
import { type QueueItem } from '@/app/api/actions/queue/route'
import { Badge } from '@/components/ui/badge'

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'overdue' | 'today' | 'waiting' | 'no_action' | 'done_today'

interface FilterTab {
  key:   FilterKey
  label: string
  icon:  React.ComponentType<{ className?: string }>
  color: string
}

const FILTERS: FilterTab[] = [
  { key: 'all',       label: 'Все',                  icon: Inbox,        color: 'text-muted-foreground' },
  { key: 'overdue',   label: 'Просрочено',           icon: AlertCircle,  color: 'text-red-400' },
  { key: 'today',     label: 'На сегодня',           icon: Clock,        color: 'text-yellow-400' },
  { key: 'waiting',   label: 'Ждёт ответа',          icon: MessageSquare, color: 'text-orange-400' },
  { key: 'no_action', label: 'Без след. действия',   icon: Inbox,        color: 'text-blue-400' },
  { key: 'done_today',label: 'Выполнено сегодня',    icon: CheckCircle2, color: 'text-neon-green' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bucketLabel(b: QueueItem['bucket']): string {
  switch (b) {
    case 'overdue':    return 'Просрочено'
    case 'today':      return 'На сегодня'
    case 'waiting':    return 'Ждёт ответа'
    case 'no_action':  return 'Без действия'
    case 'done_today': return 'Выполнено'
  }
}

function bucketColor(b: QueueItem['bucket']): string {
  switch (b) {
    case 'overdue':    return 'text-red-400 border-red-400/40 bg-red-400/10'
    case 'today':      return 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10'
    case 'waiting':    return 'text-orange-400 border-orange-400/40 bg-orange-400/10'
    case 'no_action':  return 'text-blue-400 border-blue-400/40 bg-blue-400/10'
    case 'done_today': return 'text-neon-green border-neon-green/40 bg-neon-green/10'
  }
}

/** Convert a QueueItem to the minimal NormalisedLead shape needed by LeadDetailPanel */
function toNormalisedLead(item: QueueItem): NormalisedLead {
  return {
    id:          item.lead_id,
    title:       item.lead_title,
    url:         item.lead_url,
    source:      item.lead_source ?? undefined,
    source_slug: item.lead_source ?? undefined,
    status:      item.current_stage ?? undefined,
    _raw:        { lead_id: item.lead_id, title: item.lead_title, url: item.lead_url },
  }
}

// ─── Queue item card ──────────────────────────────────────────────────────────

function QueueCard({
  item,
  selected,
  onClick,
}: {
  item:     QueueItem
  selected: boolean
  onClick:  () => void
}) {
  const isOverdue = item.bucket === 'overdue' ||
    (item.due_at && item.bucket !== 'done_today' && new Date(item.due_at) < new Date())

  const stageRu = item.current_stage
    ? (STAGE_LABEL_RU[item.current_stage as Stage] ?? item.current_stage)
    : null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
        selected
          ? 'border-neon-cyan/50 bg-neon-cyan/5'
          : 'border-border hover:border-border/80 hover:bg-secondary/40'
      }`}
    >
      {/* Row 1: bucket badge + title */}
      <div className="flex items-start gap-2 mb-1">
        <span className={`flex-shrink-0 mt-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${bucketColor(item.bucket)}`}>
          {bucketLabel(item.bucket)}
        </span>
        <span className="flex-1 text-xs font-medium text-foreground leading-tight line-clamp-2">
          {item.lead_title}
        </span>
      </div>

      {/* Row 2: source + stage */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
        {item.lead_source && (
          <span className="truncate max-w-[120px]">{item.lead_source}</span>
        )}
        {item.lead_source && stageRu && <span>·</span>}
        {stageRu && <span>{stageRu}</span>}
      </div>

      {/* Row 3: action + due date */}
      {(item.action_type || item.due_at) && (
        <div className="flex items-center gap-2 text-[10px]">
          {item.action_type && (
            <span className="text-muted-foreground/70">
              {ACTION_TYPE_RU[item.action_type as ActionType] ?? item.action_type}
            </span>
          )}
          {item.due_at && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400 font-medium' : 'text-muted-foreground/60'}`}>
              <Clock className="w-2.5 h-2.5" />
              {isOverdue && item.bucket === 'overdue' ? 'Просрочено · ' : ''}
              {formatDateTime(item.due_at)}
            </span>
          )}
          {item.done_at && item.bucket === 'done_today' && (
            <span className="text-neon-green/70 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {formatDateTime(item.done_at)}
            </span>
          )}
        </div>
      )}

      {/* Row 4: note */}
      {item.note && (
        <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">{item.note}</p>
      )}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface QueueData {
  buckets: {
    overdue:    QueueItem[]
    today:      QueueItem[]
    waiting:    QueueItem[]
    no_action:  QueueItem[]
    done_today: QueueItem[]
  }
  counts: {
    overdue:    number
    today:      number
    waiting:    number
    no_action:  number
    done_today: number
    total:      number
  }
}

export default function QueuePage() {
  const [data, setData]           = useState<QueueData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [filter, setFilter]       = useState<FilterKey>('all')
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)
  const [outcomes, setOutcomes]   = useState<Record<string, string>>({})

  async function loadQueue() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(buildApiUrl('/api/actions/queue'), { cache: 'no-store' })
      if (!res.ok) {
        const txt = await res.text()
        setError(`HTTP ${res.status}: ${txt.slice(0, 200)}`)
        return
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadQueue() }, [])

  // Flatten all items or filter by bucket
  const items = useMemo<QueueItem[]>(() => {
    if (!data) return []
    if (filter === 'all') {
      return [
        ...data.buckets.overdue,
        ...data.buckets.today,
        ...data.buckets.waiting,
        ...data.buckets.no_action,
        ...data.buckets.done_today,
      ]
    }
    return data.buckets[filter] ?? []
  }, [data, filter])

  function handleOutcomeSet(leadId: string | number, outcome: string) {
    setOutcomes((prev) => ({ ...prev, [String(leadId)]: outcome }))
  }

  const selectedLead = selectedItem ? toNormalisedLead(selectedItem) : null

  return (
    <div className="flex gap-0 h-full animate-fade-in" style={{ height: 'calc(100vh - 104px)' }}>
      {/* ── Left: queue list ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 pr-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-base font-semibold">Очередь менеджера</h1>
            {data && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.counts.total} активных ·{' '}
                {data.counts.overdue > 0 && (
                  <span className="text-red-400 font-medium">{data.counts.overdue} просрочено · </span>
                )}
                {data.counts.done_today} выполнено сегодня
              </p>
            )}
          </div>
          <button
            onClick={loadQueue}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 flex-wrap mb-3">
          {FILTERS.map((f) => {
            const count =
              f.key === 'all'
                ? data?.counts.total
                : f.key === 'done_today'
                ? data?.counts.done_today
                : data?.counts[f.key as keyof typeof data.counts]
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setSelectedItem(null) }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${
                  active
                    ? 'border-neon-cyan/50 bg-neon-cyan/5 text-neon-cyan'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                }`}
              >
                <f.icon className={`w-3 h-3 ${active ? 'text-neon-cyan' : f.color}`} />
                {f.label}
                {count !== undefined && count > 0 && (
                  <span className={`ml-0.5 text-[10px] font-medium ${active ? 'text-neon-cyan' : 'text-muted-foreground/70'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-xs text-red-400">
            <p className="font-semibold mb-1">Ошибка загрузки очереди</p>
            <p className="font-mono">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">
              {filter === 'all' ? 'Очередь пуста' : 'Нет элементов в этом фильтре'}
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
            {items.map((item) => {
              // deduplicate key: use action_id if exists, else lead_id+bucket
              const key = item.action_id ?? `${item.lead_id}__${item.bucket}`
              return (
                <QueueCard
                  key={key}
                  item={{ ...item, current_stage: outcomes[item.lead_id] ?? item.current_stage }}
                  selected={
                    selectedItem
                      ? (selectedItem.action_id
                          ? selectedItem.action_id === item.action_id
                          : selectedItem.lead_id === item.lead_id && selectedItem.bucket === item.bucket)
                      : false
                  }
                  onClick={() => setSelectedItem(item)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* ── Right: detail panel ─────────────────────────────────────────── */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedItem(null)}
          onOutcomeSet={handleOutcomeSet}
        />
      )}
    </div>
  )
}
