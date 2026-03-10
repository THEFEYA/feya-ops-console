import { createAdminClient } from '../supabase/server'

// ─── Types ─────────────────────────────────────────────────────────────────────

export const ACTION_TYPES = [
  'research',
  'contact',
  'follow_up',
  'meeting',
  'proposal',
  'close',
] as const

export const ACTION_STATUSES = ['planned', 'done', 'canceled'] as const

export type ActionType   = (typeof ACTION_TYPES)[number]
export type ActionStatus = (typeof ACTION_STATUSES)[number]

/** Russian labels for action types — visible to operator */
export const ACTION_TYPE_RU: Record<ActionType, string> = {
  research:   'Изучить',
  contact:    'Написать',
  follow_up:  'Напомнить',
  meeting:    'Встреча',
  proposal:   'КП',
  close:      'Закрыть',
}

/** Russian labels for action statuses */
export const ACTION_STATUS_RU: Record<ActionStatus, string> = {
  planned:  'Запланировано',
  done:     'Выполнено',
  canceled: 'Отменено',
}

export interface LeadAction {
  action_id:     string
  lead_id:       string
  action_type:   ActionType
  action_status: ActionStatus
  note:          string | null
  due_at:        string | null
  done_at:       string | null
  actor_label:   string | null
  meta:          Record<string, unknown>
  created_at:    string
}

// ─── Query functions ────────────────────────────────────────────────────────────

/** Fetch all actions for a lead, newest first (limit 50) */
export async function getLeadActions(
  leadId: string | number
): Promise<{ ok: boolean; data?: LeadAction[]; error?: string }> {
  const sb = createAdminClient()
  try {
    const { data, error } = await sb
      .from('lead_actions')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as LeadAction[] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Create a new action for a lead */
export async function createLeadAction(
  leadId: string | number,
  actionType: ActionType,
  opts: {
    note?:        string
    due_at?:      string   // ISO string or null
    actor_label?: string
    meta?:        Record<string, unknown>
  } = {}
): Promise<{ ok: boolean; data?: LeadAction; error?: string }> {
  const sb = createAdminClient()
  try {
    const { data, error } = await sb
      .from('lead_actions')
      .insert({
        lead_id:      leadId,
        action_type:  actionType,
        action_status: 'planned',
        note:         opts.note         ?? null,
        due_at:       opts.due_at       ?? null,
        actor_label:  opts.actor_label  ?? null,
        meta:         opts.meta         ?? {},
      })
      .select()
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as LeadAction }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Update the status of an existing action (done / canceled) */
export async function updateLeadActionStatus(
  actionId: string,
  status: 'done' | 'canceled'
): Promise<{ ok: boolean; data?: LeadAction; error?: string }> {
  const sb = createAdminClient()
  try {
    const patch: Record<string, unknown> = { action_status: status }
    if (status === 'done') patch.done_at = new Date().toISOString()
    const { data, error } = await sb
      .from('lead_actions')
      .update(patch)
      .eq('action_id', actionId)
      .select()
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as LeadAction }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
