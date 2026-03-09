/**
 * Stage Transition Policy — single source of truth.
 *
 * Describes which stage→stage moves are allowed and what kind they are.
 * Shared by server validation (route handler) and client UI (toast messages).
 */

export type StageType =
  | 'shortlisted'
  | 'approved'
  | 'rejected'
  | 'qualified'
  | 'contacted'
  | 'replied'
  | 'meeting'
  | 'proposal'
  | 'won'
  | 'lost'

export type TransitionKind = 'forward' | 'rollback' | 'reopen' | 'decision' | 'terminal'

export interface TransitionResult {
  allowed: boolean
  kind?: TransitionKind
  /** Russian-language reason for forbidden transitions */
  reason?: string
}

/**
 * Decision stages: independent of the progress chain.
 * Any transition to a decision stage is always allowed.
 */
const DECISION_STAGES = new Set<StageType>(['shortlisted', 'approved', 'rejected'])

/**
 * Progress chain order (index = order in pipeline).
 */
const PROGRESS_CHAIN: StageType[] = [
  'qualified',
  'contacted',
  'replied',
  'meeting',
  'proposal',
]

const PROGRESS_ORDER: Map<StageType, number> = new Map(
  PROGRESS_CHAIN.map((s, i) => [s, i])
)

/**
 * Terminal stages and which stages can reach them.
 * won/lost are reachable from proposal, meeting, replied, contacted, qualified.
 */
const TERMINAL_STAGES = new Set<StageType>(['won', 'lost'])

const CAN_REACH_TERMINAL = new Set<StageType>([
  'qualified',
  'contacted',
  'replied',
  'meeting',
  'proposal',
])

/**
 * Reopen: after won/lost the lead can only go back to proposal or meeting.
 */
const REOPEN_TARGETS = new Set<StageType>(['proposal', 'meeting'])

/**
 * Determine whether a stage transition is allowed and what kind it is.
 *
 * @param from  Current (latest) stage. Pass null when no stage has been set yet.
 * @param to    Requested target stage.
 */
export function checkTransition(from: StageType | null, to: StageType): TransitionResult {
  // No previous stage — any first assignment is allowed (treated as 'forward' or 'decision')
  if (from === null) {
    return { allowed: true, kind: DECISION_STAGES.has(to) ? 'decision' : 'forward' }
  }

  // Same stage — dedup handles it; treat as allowed (will be skipped by dedup)
  if (from === to) {
    return { allowed: true, kind: DECISION_STAGES.has(to) ? 'decision' : 'forward' }
  }

  // Target is a decision stage — always allowed
  if (DECISION_STAGES.has(to)) {
    return { allowed: true, kind: 'decision' }
  }

  // From a decision stage to any progress stage — allowed as forward
  if (DECISION_STAGES.has(from)) {
    return { allowed: true, kind: TERMINAL_STAGES.has(to) ? 'terminal' : 'forward' }
  }

  // Reopen: won/lost → proposal/meeting
  if (TERMINAL_STAGES.has(from) && REOPEN_TARGETS.has(to)) {
    return { allowed: true, kind: 'reopen' }
  }

  // Blocked: won/lost → anything else except reopen targets
  if (TERMINAL_STAGES.has(from) && !REOPEN_TARGETS.has(to)) {
    return {
      allowed: false,
      reason: `Переход из ${stageLabel(from)} разрешён только в КП или Встречу (переоткрытие). Переход в «${stageLabel(to)}» запрещён.`,
    }
  }

  // Transitions within progress chain
  const fromOrder = PROGRESS_ORDER.get(from)
  const toOrder = PROGRESS_ORDER.get(to)

  if (toOrder !== undefined && fromOrder !== undefined) {
    if (toOrder > fromOrder) return { allowed: true, kind: 'forward' }
    if (toOrder < fromOrder) return { allowed: true, kind: 'rollback' }
    // equal handled above (same stage)
  }

  // Progress → terminal
  if (CAN_REACH_TERMINAL.has(from) && TERMINAL_STAGES.has(to)) {
    return { allowed: true, kind: 'terminal' }
  }

  // Fallback: unknown combination — allow (new stages added later)
  return { allowed: true, kind: 'forward' }
}

/**
 * Human-readable Russian label for a stage (inline, no import needed).
 */
function stageLabel(stage: StageType): string {
  const labels: Record<StageType, string> = {
    shortlisted: 'Шортлист',
    approved: 'Одобрен',
    rejected: 'Отклонён',
    qualified: 'Квалифицирован',
    contacted: 'Написали',
    replied: 'Ответил',
    meeting: 'Встреча',
    proposal: 'КП отправлено',
    won: 'Сделка',
    lost: 'Провал',
  }
  return labels[stage] ?? stage
}
