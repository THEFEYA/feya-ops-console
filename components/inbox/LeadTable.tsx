'use client'

import { NormalisedLead } from '@/lib/field-resolver'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { formatRelative, warmthColor, warmthLabel, truncate, cn } from '@/lib/utils'
import { Users } from 'lucide-react'

interface Props {
  leads: NormalisedLead[]
  selectedId?: string | number | null
  onSelect: (lead: NormalisedLead) => void
  outcomes: Record<string | number, string>
}

function outcomeVariant(o?: string): 'green' | 'cyan' | 'red' | 'outline' | undefined {
  if (!o) return undefined
  if (o === 'approved' || o === 'won') return 'green'
  if (o === 'rejected' || o === 'lost') return 'red'
  if (['shortlisted', 'qualified', 'contacted', 'replied', 'meeting', 'proposal'].includes(o)) return 'cyan'
  return 'outline'
}

const STAGE_LABELS_RU: Record<string, string> = {
  approved:    'Одобрен',
  shortlisted: 'Шортлист',
  rejected:    'Отклонён',
  qualified:   'Квалифицирован',
  contacted:   'Написали',
  replied:     'Ответил',
  meeting:     'Встреча',
  proposal:    'КП',
  won:         'Сделка',
  lost:        'Провал',
}

function outcomeLabel(o?: string): string {
  return STAGE_LABELS_RU[o ?? ''] ?? o ?? ''
}

export function LeadTable({ leads, selectedId, onSelect, outcomes }: Props) {
  if (leads.length === 0) {
    return <EmptyState icon={Users} title="Лиды не найдены" description="Попробуйте изменить фильтры" />
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden flex-1">
      <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-secondary/60 backdrop-blur">
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Заголовок</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-16">Скор</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-20">Интент</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-24 hidden md:table-cell">Источник</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-20 hidden lg:table-cell">Когда</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-24">Статус</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const outcome = outcomes[lead.id] ?? lead.status
              const isSelected = selectedId === lead.id
              return (
                <tr
                  key={`${lead.id}-${i}`}
                  onClick={() => onSelect(lead)}
                  className={cn(
                    'border-b border-border/40 cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-neon-cyan/5 border-l-2 border-l-neon-cyan'
                      : 'hover:bg-secondary/30'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground line-clamp-1" title={lead.title}>
                      {truncate(lead.title, 60)}
                    </div>
                    {lead.domain && (
                      <div className="text-muted-foreground/60 text-[10px] mt-0.5">{lead.domain}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {lead.score != null ? (
                      <span className="font-mono font-bold text-neon-cyan">{lead.score}</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {lead.warmth ? (
                      <span className={warmthColor(lead.warmth)}>{warmthLabel(lead.warmth)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">
                    {truncate(lead.source, 18) ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">
                    {formatRelative(lead.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    {outcome ? (
                      <Badge variant={outcomeVariant(outcome)}>{outcomeLabel(outcome)}</Badge>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
