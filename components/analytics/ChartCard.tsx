'use client'

import { useState, useRef } from 'react'
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { useAnalytics, type ChartType, type ChartConfig } from '@/lib/analytics/context'

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Столбцы' },
  { value: 'line', label: 'Линия' },
  { value: 'area', label: 'Область' },
  { value: 'pie', label: 'Круг' },
  { value: 'scatter', label: 'Точки' },
]

const METRICS = [
  { value: 'leads_cnt', label: 'Лиды' },
  { value: 'avg_score', label: 'Avg Score' },
  { value: 'avg_intent_score', label: 'Avg Intent' },
  { value: 'avg_reach_score', label: 'Avg Reach' },
  { value: 'max_score', label: 'Max Score' },
]

const GROUPBY_OPTIONS = [
  { value: 'day', label: 'День' },
  { value: 'source_slug', label: 'Источник' },
  { value: 'warmth', label: 'Интент' },
  { value: 'event', label: 'Событие' },
  { value: 'bucket', label: 'Бакет' },
  { value: 'persona_tag', label: 'Персона' },
  { value: 'source_platform', label: 'Платформа' },
]

interface Props {
  chartId: string
  defaultTitle: string
  children: (config: ChartConfig) => React.ReactNode
}

export function ChartCard({ chartId, defaultTitle, children }: Props) {
  const { state, dispatch, getLabel } = useAnalytics()
  const config = state.chartConfig[chartId]
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const titleRef = useRef<HTMLSpanElement>(null)

  if (!config) return null

  const collapsed = config.collapsed
  const title = getLabel(`chart_title_${chartId}`, config.title || defaultTitle)

  function update(patch: Partial<ChartConfig>) {
    dispatch({ type: 'UPDATE_CHART', payload: { id: chartId, ...patch } })
  }

  function handleTitleDblClick() {
    setRenameValue(title)
    setRenaming(true)
  }

  function commitRename() {
    if (renameValue.trim()) {
      dispatch({ type: 'SET_LABEL', payload: { key: `chart_title_${chartId}`, label: renameValue.trim() } })
    }
    setRenaming(false)
  }

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-secondary/30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false) }}
              className="bg-background border border-neon-cyan/40 rounded px-2 py-0.5 text-sm text-foreground w-full max-w-xs"
            />
          ) : (
            <span
              ref={titleRef}
              className="text-sm font-medium text-foreground cursor-pointer select-none truncate"
              onDoubleClick={handleTitleDblClick}
              title="Двойной клик — переименовать"
            >
              {title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={`p-1.5 rounded hover:bg-secondary transition-colors ${settingsOpen ? 'text-neon-cyan' : 'text-muted-foreground'}`}
            title="Настройки графика"
          >
            <Settings2 size={14} />
          </button>
          <button
            onClick={() => update({ collapsed: !collapsed })}
            className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground"
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* Settings row */}
      {settingsOpen && !collapsed && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 border-b border-border/40 bg-secondary/10 text-xs">
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Тип:
            <select
              value={config.type}
              onChange={(e) => update({ type: e.target.value as ChartType })}
              className="bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground"
            >
              {CHART_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Метрика:
            <select
              value={config.metric}
              onChange={(e) => update({ metric: e.target.value })}
              className="bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground"
            >
              {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          {config.type !== 'pie' && config.groupBy !== 'day' && (
            <label className="flex items-center gap-1.5 text-muted-foreground">
              Группировка:
              <select
                value={config.groupBy}
                onChange={(e) => update({ groupBy: e.target.value })}
                className="bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground"
              >
                {GROUPBY_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      {/* Content */}
      {!collapsed && (
        <div className="p-4">
          {children(config)}
        </div>
      )}
    </div>
  )
}
