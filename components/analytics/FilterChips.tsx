'use client'

import { useAnalytics } from '@/lib/analytics/context'

const DIM_LABELS: Record<string, string> = {
  source_slug: 'Источник',
  warmth: 'Интент',
  event: 'Событие',
  bucket: 'Бакет',
  persona_tag: 'Персона',
  source_platform: 'Платформа',
  day: 'День',
}

export function FilterChips() {
  const { state, dispatch, getLabel } = useAnalytics()
  const { filters } = state

  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-xs text-muted-foreground shrink-0">Фильтры:</span>
      {filters.map((f) => (
        <span
          key={`${f.dimension}:${f.value}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-cyan/20 border border-neon-cyan/40 text-xs text-neon-cyan"
        >
          <span className="text-muted-foreground">{DIM_LABELS[f.dimension] ?? f.dimension}:</span>
          {getLabel(f.value, f.value)}
          <button
            onClick={() => dispatch({ type: 'REMOVE_FILTER', payload: { dimension: f.dimension, value: f.value } })}
            className="ml-0.5 text-neon-cyan/70 hover:text-neon-cyan transition-colors leading-none"
            aria-label="Убрать фильтр"
          >
            ×
          </button>
        </span>
      ))}
      <button
        onClick={() => dispatch({ type: 'RESET_FILTERS' })}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
      >
        Сбросить всё
      </button>
    </div>
  )
}
