/**
 * lib/domain/stage.ts
 * Single source of truth for lead pipeline stages.
 * Import from here — never define stage lists/labels locally.
 */

export const STAGES = [
  'shortlisted',
  'approved',
  'rejected',
  'qualified',
  'contacted',
  'replied',
  'meeting',
  'proposal',
  'won',
  'lost',
] as const

export type Stage = (typeof STAGES)[number]

/** Russian display labels for UI */
export const STAGE_LABEL_RU: Record<Stage, string> = {
  shortlisted: 'Шортлист',
  approved:    'Одобрен',
  rejected:    'Отклонён',
  qualified:   'Квалифицирован',
  contacted:   'Написали',
  replied:     'Ответил',
  meeting:     'Встреча',
  proposal:    'КП',
  won:         'Сделка',
  lost:        'Провал',
}

/**
 * Canonical display order.
 * decision group first (shortlisted/approved/rejected), then progress pipeline.
 */
export const STAGE_ORDER: Stage[] = [
  'shortlisted',
  'approved',
  'rejected',
  'qualified',
  'contacted',
  'replied',
  'meeting',
  'proposal',
  'won',
  'lost',
]

/** Logical grouping for UI button groups */
export const STAGE_GROUP: Record<Stage, 'decision' | 'progress'> = {
  shortlisted: 'decision',
  approved:    'decision',
  rejected:    'decision',
  qualified:   'progress',
  contacted:   'progress',
  replied:     'progress',
  meeting:     'progress',
  proposal:    'progress',
  won:         'progress',
  lost:        'progress',
}

/** Returns RU label for any string stage value; falls back to the raw value */
export function stageLabel(s: string | undefined | null): string {
  if (!s) return ''
  return STAGE_LABEL_RU[s as Stage] ?? s
}

/** Badge variant for a stage value */
export function stageVariant(s: string | undefined | null): 'green' | 'cyan' | 'red' | 'outline' | undefined {
  if (!s) return undefined
  if (s === 'approved' || s === 'won') return 'green'
  if (s === 'rejected' || s === 'lost') return 'red'
  if (STAGE_GROUP[s as Stage] === 'progress' || s === 'shortlisted') return 'cyan'
  return 'outline'
}
