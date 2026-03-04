'use client'

import { useEffect, useState } from 'react'
import { NeonCard } from '@/components/shared/NeonCard'
import { StatusDot } from '@/components/shared/StatusDot'
import { formatRelative, buildApiUrl } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

type NodeStatus = 'ok' | 'running' | 'error' | 'warn' | 'idle'

interface PipelineNodeData {
  id: string
  label: string
  description: string
  queued: number
  running: number
  failed: number
  lastActivity?: string
  status: NodeStatus
}

const PIPELINE_NODES: Omit<PipelineNodeData, 'queued' | 'running' | 'failed' | 'lastActivity' | 'status'>[] = [
  { id: 'collectors', label: 'Коллекторы', description: 'SERP / Reddit / Places' },
  { id: 'leads', label: 'Лиды', description: 'Приём и хранение' },
  { id: 'extractors', label: 'Экстракторы', description: 'Извлечение людей' },
  { id: 'scoring', label: 'Скоринг', description: 'Сигналы и оценка' },
  { id: 'outreach', label: 'Outreach', description: 'Очередь рассылки' },
  { id: 'digest', label: 'Дайджест', description: 'Email-сводка' },
]

interface Props {
  onNodeSelect?: (nodeId: string | null) => void
  selectedNode?: string | null
}

type AnyRecord = Record<string, unknown>

function computeNodes(rawTasks: AnyRecord[]): PipelineNodeData[] {
  // Map task nodes to pipeline stages by keyword matching
  const nodeMapping: Record<string, string[]> = {
    collectors: ['collector', 'serp', 'reddit_rss', 'places', 'osm'],
    leads: ['lead', 'ingest'],
    extractors: ['extract', 'people', 'rpf'],
    scoring: ['score', 'signal', 'detector'],
    outreach: ['outreach', 'contact', 'message'],
    digest: ['digest', 'email'],
  }

  return PIPELINE_NODES.map((node) => {
    const keywords = nodeMapping[node.id] ?? []
    const related = rawTasks.filter((t) => {
      const name = String(t.name ?? t.type ?? t.function_name ?? t.node ?? '').toLowerCase()
      return keywords.some((k) => name.includes(k))
    })

    const queued = related.filter((t) =>
      ['queued', 'pending', 'open'].includes(String(t.status ?? '').toLowerCase())
    ).length
    const running = related.filter((t) =>
      ['running', 'active', 'processing', 'in_progress'].includes(String(t.status ?? '').toLowerCase())
    ).length
    const failed = related.filter((t) =>
      ['error', 'failed'].includes(String(t.status ?? '').toLowerCase())
    ).length

    const timestamps = related
      .map((t) => t.created_at ?? t.updated_at ?? t.ts)
      .filter(Boolean)
      .map((d) => new Date(String(d)).getTime())
      .filter((d) => !isNaN(d))

    const lastActivity = timestamps.length
      ? new Date(Math.max(...timestamps)).toISOString()
      : undefined

    let status: NodeStatus = 'idle'
    if (failed > 0) status = 'error'
    else if (running > 0) status = 'running'
    else if (queued > 0) status = 'warn'
    else if (related.length > 0) status = 'ok'

    return { ...node, queued, running, failed, lastActivity, status }
  })
}

export function PipelineGraph({ onNodeSelect, selectedNode }: Props) {
  const [nodes, setNodes] = useState<PipelineNodeData[]>(
    PIPELINE_NODES.map((n) => ({ ...n, queued: 0, running: 0, failed: 0, status: 'idle' }))
  )

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(buildApiUrl('/api/sb/query', { name: 'pipeline_stats' }))
        const json = await res.json()
        if (json.data) {
          setNodes(computeNodes(json.data as AnyRecord[]))
        }
      } catch (e) {
        console.error(e)
      }
    }
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
        Пайплайн
      </h2>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
        {nodes.map((node, i) => (
          <div key={node.id} className="flex items-center gap-1 min-w-0">
            <div
              className={`pipeline-node min-w-[130px] flex-shrink-0 ${selectedNode === node.id ? 'active' : ''}`}
              onClick={() => onNodeSelect?.(selectedNode === node.id ? null : node.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <StatusDot status={node.status} />
                <span className="text-xs font-semibold truncate">{node.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3 leading-tight">{node.description}</p>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div className="text-center">
                  <div className="text-neon-yellow font-mono font-bold">{node.queued}</div>
                  <div className="text-muted-foreground">очередь</div>
                </div>
                <div className="text-center">
                  <div className="text-neon-cyan font-mono font-bold">{node.running}</div>
                  <div className="text-muted-foreground">активно</div>
                </div>
                <div className="text-center">
                  <div className="text-neon-red font-mono font-bold">{node.failed}</div>
                  <div className="text-muted-foreground">ошибки</div>
                </div>
              </div>
              {node.lastActivity && (
                <p className="text-[10px] text-muted-foreground/60 mt-2 truncate">
                  {formatRelative(node.lastActivity)}
                </p>
              )}
            </div>
            {i < nodes.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
