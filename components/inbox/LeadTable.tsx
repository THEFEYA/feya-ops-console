'use client'

import { NormalisedLead } from '@/lib/field-resolver'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { formatRelative, truncate, cn } from '@/lib/utils'
import { ListChecks } from 'lucide-react'

interface Props {
  leads: NormalisedLead[]
  selectedId?: string | number | null
  onSelect: (lead: NormalisedLead) => void
  mode: 'queue' | 'inbox'
}

function chipTone(value?: string | null) {
  const v = String(value ?? '').toLowerCase()
  if (!v) return 'outline' as const
  if (v.includes('личн') || v.includes('review') || v.includes('контрол')) return 'red' as const
  if (v.includes('готов') || v.includes('completed') || v.includes('одоб')) return 'green' as const
  if (v.includes('draft') || v.includes('сценар') || v.includes('cold') || v.includes('ответа пока нет')) return 'cyan' as const
  return 'outline' as const
}

export function LeadTable({ leads, selectedId, onSelect, mode }: Props) {
  if (leads.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title={mode === 'queue' ? 'Очередь пока пуста' : 'Во входящих пока ничего нет'}
        description={mode === 'queue' ? 'Новые объекты появятся здесь, когда FEYA подготовит рабочую очередь.' : 'Здесь появятся диалоги, где уже есть ответ и нужен follow-up.'}
      />
    )
  }

  return (
    <div className="border border-border rounded-2xl overflow-hidden flex-1 bg-card/40 backdrop-blur-sm">
      <div className="overflow-y-auto max-h-[calc(100vh-295px)]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-secondary/75 backdrop-blur">
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Объект</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Сценарий</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Следующий шаг</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Режим</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Состояние</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Источник</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const isSelected = selectedId === lead.id
              const scenario = lead.scenario_cluster_name || 'Сценарий уточняется'
              const nextStep = lead.next_best_action || (mode === 'queue' ? 'Нужно уточнить сценарий и выбрать первый безопасный шаг' : 'Нужно оценить ответ и подготовить follow-up')
              const state = lead.queue_row_state_ru || lead.operator_status_ru || lead.reply_state_ru || 'Состояние уточняется'
              return (
                <tr
                  key={`${lead.id}-${i}`}
                  onClick={() => onSelect(lead)}
                  className={cn(
                    'border-b border-border/40 cursor-pointer transition-colors align-top',
                    isSelected ? 'bg-neon-cyan/5 border-l-2 border-l-neon-cyan' : 'hover:bg-secondary/25'
                  )}
                >
                  <td className="px-3 py-3 min-w-[240px]">
                    <div className="font-medium text-foreground line-clamp-1" title={lead.title}>{truncate(lead.title, 72)}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {lead.business_name && <Badge variant="outline">{truncate(lead.business_name, 28)}</Badge>}
                      {lead.stage_family_ru && <Badge variant={chipTone(lead.stage_family_ru)}>{lead.stage_family_ru}</Badge>}
                      {lead.reply_state_ru && <Badge variant={chipTone(lead.reply_state_ru)}>{lead.reply_state_ru}</Badge>}
                    </div>
                    {(lead.snippet || lead.binding_description_ru) && (
                      <div className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{truncate(lead.snippet || lead.binding_description_ru, 120)}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell align-top">
                    <div className="font-medium text-foreground">{scenario}</div>
                    {lead.framework_cta_mode && <div className="text-[11px] text-muted-foreground mt-1">CTA: {lead.framework_cta_mode}</div>}
                  </td>
                  <td className="px-3 py-3 min-w-[220px] align-top">
                    <div className="font-medium text-foreground line-clamp-2">{nextStep}</div>
                    {lead.desired_response && <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">Ожидаемый ответ: {lead.desired_response}</div>}
                  </td>
                  <td className="px-3 py-3 hidden xl:table-cell align-top">
                    <div className="font-medium text-foreground">{lead.execution_mode_ru || 'Режим уточняется'}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{formatRelative(lead.created_at)}</div>
                  </td>
                  <td className="px-3 py-3 align-top min-w-[160px]">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={chipTone(state)}>{state}</Badge>
                      {lead.draft_status && <Badge variant={chipTone(lead.draft_status)}>Драфт: {lead.draft_status}</Badge>}
                      {lead.approval_status && <Badge variant={chipTone(lead.approval_status)}>Review: {lead.approval_status}</Badge>}
                      {lead.handoff_status && <Badge variant={chipTone(lead.handoff_status)}>Контроль: {lead.handoff_status}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell align-top text-muted-foreground">{lead.source || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
