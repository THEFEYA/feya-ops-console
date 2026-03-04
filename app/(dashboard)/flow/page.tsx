'use client'

import { useState } from 'react'
import { KpiCards } from '@/components/flow/KpiCards'
import { PipelineGraph } from '@/components/flow/PipelineGraph'
import { ActivityTable } from '@/components/flow/ActivityTable'

export default function FlowPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  return (
    <div className="space-y-6 animate-fade-in">
      <KpiCards />
      <PipelineGraph onNodeSelect={setSelectedNode} selectedNode={selectedNode} />
      <ActivityTable filterNode={selectedNode} />
    </div>
  )
}
