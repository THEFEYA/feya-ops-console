'use client'

import { useState } from 'react'
import { KpiCards } from '@/components/flow/KpiCards'
import { PipelineGraph } from '@/components/flow/PipelineGraph'
import { ActivityTable } from '@/components/flow/ActivityTable'
import { SystemStatusBlock } from '@/components/flow/SystemStatusBlock'

export default function FlowPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  return (
    <div className="space-y-6 animate-fade-in">
      <KpiCards />
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Состояние функций
        </h2>
        <SystemStatusBlock />
      </section>
      <PipelineGraph onNodeSelect={setSelectedNode} selectedNode={selectedNode} />
      <ActivityTable filterNode={selectedNode} />
    </div>
  )
}
