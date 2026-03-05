'use client'

import { useState, useRef } from 'react'

type RollupRow = Record<string, unknown>

const DIMENSIONS = [
  { key: 'source_slug', label: 'Источник' },
  { key: 'event', label: 'Событие' },
  { key: 'warmth', label: 'Интент' },
  { key: 'bucket', label: 'Бакет' },
  { key: 'persona_tag', label: 'Персона' },
  { key: 'source_platform', label: 'Платформа' },
]

const METRICS = [
  { key: 'leads_cnt', label: 'Лиды' },
  { key: 'avg_score', label: 'Avg Score' },
  { key: 'avg_intent_score', label: 'Avg Intent' },
  { key: 'avg_reach_score', label: 'Avg Reach' },
  { key: 'max_score', label: 'Max Score' },
]

interface Props {
  rows: RollupRow[]
}

export function PivotTable({ rows }: Props) {
  const [dimension, setDimension] = useState('source_slug')
  const [activeMetrics, setActiveMetrics] = useState<string[]>(['leads_cnt', 'avg_score'])
  const [sortCol, setSortCol] = useState('leads_cnt')
  const [sortAsc, setSortAsc] = useState(false)
  const [colOrder, setColOrder] = useState<string[]>(METRICS.map((m) => m.key))
  const dragFrom = useRef<number | null>(null)

  // Derive ordered visible columns
  const orderedCols = colOrder.filter((c) => activeMetrics.includes(c))
  const newCols = activeMetrics.filter((c) => !colOrder.includes(c))
  const cols = [...orderedCols, ...newCols]

  // Aggregate by dimension
  const agg: Record<string, Record<string, number>> = {}
  for (const row of rows) {
    const dimVal = String(row[dimension] ?? '').trim()
    if (!dimVal) continue
    if (!agg[dimVal]) agg[dimVal] = {}
    for (const { key: m } of METRICS) {
      const v = Number(row[m] ?? 0)
      const cnt = Number(row['leads_cnt'] ?? 1)
      if (m.startsWith('avg_')) {
        agg[dimVal][`${m}_wsum`] = (agg[dimVal][`${m}_wsum`] ?? 0) + v * cnt
        agg[dimVal][`${m}_n`] = (agg[dimVal][`${m}_n`] ?? 0) + cnt
      } else if (m === 'max_score') {
        agg[dimVal][m] = Math.max(agg[dimVal][m] ?? 0, v)
      } else {
        agg[dimVal][m] = (agg[dimVal][m] ?? 0) + v
      }
    }
  }

  const tableRows = Object.entries(agg).map(([dimVal, vals]) => {
    const final: Record<string, string | number> = { _dim: dimVal }
    for (const { key: m } of METRICS) {
      if (m.startsWith('avg_')) {
        const n = vals[`${m}_n`] ?? 0
        final[m] = n > 0 ? Math.round((vals[`${m}_wsum`] ?? 0) / n * 10) / 10 : 0
      } else {
        final[m] = vals[m] ?? 0
      }
    }
    return final
  })

  tableRows.sort((a, b) => {
    const va = Number(a[sortCol] ?? 0)
    const vb = Number(b[sortCol] ?? 0)
    return sortAsc ? va - vb : vb - va
  })

  function toggleSort(col: string) {
    if (sortCol === col) setSortAsc((v) => !v)
    else { setSortCol(col); setSortAsc(false) }
  }

  function toggleMetric(key: string) {
    setActiveMetrics((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev
        return prev.filter((m) => m !== key)
      }
      return [...prev, key]
    })
  }

  function handleDragStart(i: number) { dragFrom.current = i }
  function handleDragOver(e: React.DragEvent) { e.preventDefault() }
  function handleDrop(i: number) {
    const from = dragFrom.current
    if (from === null || from === i) { dragFrom.current = null; return }
    const next = [...cols]
    const [moved] = next.splice(from, 1)
    next.splice(i, 0, moved)
    setColOrder(next)
    dragFrom.current = null
  }

  const dimLabel = DIMENSIONS.find((d) => d.key === dimension)?.label ?? dimension

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Группировка:</span>
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
          >
            {DIMENSIONS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">Метрики:</span>
          {METRICS.map((m) => (
            <label key={m.key} className="flex items-center gap-1 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={activeMetrics.includes(m.key)}
                onChange={() => toggleMetric(m.key)}
                className="accent-neon-cyan"
              />
              <span className={activeMetrics.includes(m.key) ? 'text-foreground' : 'text-muted-foreground'}>
                {m.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60">Перетащите заголовок колонки для изменения порядка · Клик — сортировка</p>

      {/* Table */}
      {tableRows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Нет данных по измерению «{dimLabel}»</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border">
                  {dimLabel}
                </th>
                {cols.map((col, i) => {
                  const m = METRICS.find((x) => x.key === col)
                  return (
                    <th
                      key={col}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(i)}
                      onClick={() => toggleSort(col)}
                      className={`text-right px-3 py-2 font-medium border-b border-border cursor-pointer select-none hover:text-foreground transition-colors ${
                        sortCol === col ? 'text-neon-cyan' : 'text-muted-foreground'
                      }`}
                    >
                      {m?.label ?? col}
                      {sortCol === col && <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={String(row._dim)} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-1.5 text-foreground font-medium border-b border-border/40">
                    {String(row._dim)}
                  </td>
                  {cols.map((col) => (
                    <td
                      key={col}
                      className={`px-3 py-1.5 text-right border-b border-border/40 font-mono tabular-nums ${
                        sortCol === col ? 'text-neon-cyan' : 'text-foreground/80'
                      }`}
                    >
                      {typeof row[col] === 'number'
                        ? (row[col] as number).toLocaleString(undefined, { maximumFractionDigits: 1 })
                        : String(row[col] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
