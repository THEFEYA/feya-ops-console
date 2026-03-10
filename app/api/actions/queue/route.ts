import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface QueueItem {
  lead_id:       string
  lead_title:    string
  lead_url:      string
  lead_source:   string | null
  current_stage: string | null
  action_id:     string | null
  action_type:   string | null
  action_status: string | null
  due_at:        string | null
  done_at:       string | null
  note:          string | null
  bucket:        'overdue' | 'today' | 'waiting' | 'no_action' | 'done_today'
}

/**
 * GET /api/actions/queue
 *
 * Returns 5 buckets:
 *   overdue    — planned + due_at < start of today (past days)
 *   today      — planned + due_at >= now AND due_at <= end of today
 *   waiting    — planned contact/follow_up with no due_at
 *   no_action  — lead has active stage but zero planned actions
 *   done_today — action_status='done' + done_at today
 */
export async function GET(req: NextRequest) {
  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  const sb = createAdminClient()

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  // ── 1. Fetch action-based buckets + planned lead_ids in parallel ──────────
  const [overdueRes, todayRes, waitingRes, doneTodayRes, plannedLeadIdsRes] =
    await Promise.all([
      // Overdue: planned + due_at strictly before today's start
      sb
        .from('lead_actions')
        .select('*')
        .eq('action_status', 'planned')
        .lt('due_at', todayStart.toISOString())
        .order('due_at', { ascending: true })
        .limit(100),

      // Today: planned + due_at >= now AND <= end of today
      sb
        .from('lead_actions')
        .select('*')
        .eq('action_status', 'planned')
        .gte('due_at', now.toISOString())
        .lte('due_at', todayEnd.toISOString())
        .order('due_at', { ascending: true })
        .limit(100),

      // Waiting: planned contact/follow_up with no due_at
      sb
        .from('lead_actions')
        .select('*')
        .eq('action_status', 'planned')
        .in('action_type', ['contact', 'follow_up'])
        .is('due_at', null)
        .order('created_at', { ascending: false })
        .limit(100),

      // Done today
      sb
        .from('lead_actions')
        .select('*')
        .eq('action_status', 'done')
        .gte('done_at', todayStart.toISOString())
        .lte('done_at', todayEnd.toISOString())
        .order('done_at', { ascending: false })
        .limit(100),

      // All lead_ids that currently have a planned action (for no_action subtraction)
      sb
        .from('lead_actions')
        .select('lead_id')
        .eq('action_status', 'planned'),
    ])

  // ── 2. Compute "no_action" bucket ─────────────────────────────────────────
  const plannedLeadIds = new Set<string>(
    (plannedLeadIdsRes.data ?? []).map((r: { lead_id: string }) => r.lead_id)
  )

  const activeStages = ['shortlisted', 'approved', 'qualified', 'contacted', 'replied', 'meeting', 'proposal']

  const { data: activeStageLeads } = await sb
    .from('v_lead_current_stage')
    .select('lead_id, current_stage, source_slug')
    .in('current_stage', activeStages)
    .limit(300)

  const noActionLeads = (activeStageLeads ?? [])
    .filter((r: { lead_id: string }) => !plannedLeadIds.has(r.lead_id))
    .slice(0, 100)

  // ── 3. Batch fetch lead metadata ──────────────────────────────────────────
  const allLeadIds = new Set<string>()
  for (const arr of [overdueRes.data, todayRes.data, waitingRes.data, doneTodayRes.data]) {
    for (const row of arr ?? []) allLeadIds.add(row.lead_id)
  }
  for (const row of noActionLeads) allLeadIds.add(row.lead_id)

  let leadMap: Record<string, { title: string; url: string; source: string | null }> = {}
  if (allLeadIds.size > 0) {
    const { data: leadsData } = await sb
      .from('leads')
      .select('lead_id, title, url, source')
      .in('lead_id', [...allLeadIds])
    for (const l of leadsData ?? []) {
      leadMap[l.lead_id] = {
        title:  l.title  ?? `Лид ${String(l.lead_id).slice(0, 8)}`,
        url:    l.url    ?? '',
        source: l.source ?? null,
      }
    }
  }

  // ── 4. Batch fetch current stages for action-based items ──────────────────
  const actionLeadIds = new Set<string>()
  for (const arr of [overdueRes.data, todayRes.data, waitingRes.data, doneTodayRes.data]) {
    for (const row of arr ?? []) actionLeadIds.add(row.lead_id)
  }

  let stageMap: Record<string, string | null> = {}
  if (actionLeadIds.size > 0) {
    const { data: stagesData } = await sb
      .from('v_lead_current_stage')
      .select('lead_id, current_stage')
      .in('lead_id', [...actionLeadIds])
    for (const s of stagesData ?? []) {
      stageMap[s.lead_id] = s.current_stage
    }
  }

  // ── 5. Map rows → QueueItem ───────────────────────────────────────────────
  type ActionRow = {
    action_id: string
    lead_id: string
    action_type: string
    action_status: string
    due_at: string | null
    done_at: string | null
    note: string | null
  }

  function toItem(row: ActionRow, bucket: QueueItem['bucket']): QueueItem {
    const lead = leadMap[row.lead_id]
    return {
      lead_id:       row.lead_id,
      lead_title:    lead?.title  ?? `Лид ${row.lead_id.slice(0, 8)}`,
      lead_url:      lead?.url    ?? '',
      lead_source:   lead?.source ?? null,
      current_stage: stageMap[row.lead_id] ?? null,
      action_id:     row.action_id,
      action_type:   row.action_type,
      action_status: row.action_status,
      due_at:        row.due_at,
      done_at:       row.done_at,
      note:          row.note,
      bucket,
    }
  }

  type StageRow = {
    lead_id: string
    current_stage: string | null
    source_slug: string | null
  }

  const buckets = {
    overdue:    (overdueRes.data   ?? []).map((r: ActionRow) => toItem(r, 'overdue')),
    today:      (todayRes.data     ?? []).map((r: ActionRow) => toItem(r, 'today')),
    waiting:    (waitingRes.data   ?? []).map((r: ActionRow) => toItem(r, 'waiting')),
    done_today: (doneTodayRes.data ?? []).map((r: ActionRow) => toItem(r, 'done_today')),
    no_action:  noActionLeads.map((r: StageRow): QueueItem => ({
      lead_id:       r.lead_id,
      lead_title:    leadMap[r.lead_id]?.title  ?? `Лид ${r.lead_id.slice(0, 8)}`,
      lead_url:      leadMap[r.lead_id]?.url    ?? '',
      lead_source:   r.source_slug ?? leadMap[r.lead_id]?.source ?? null,
      current_stage: r.current_stage,
      action_id:     null,
      action_type:   null,
      action_status: null,
      due_at:        null,
      done_at:       null,
      note:          null,
      bucket:        'no_action',
    })),
  }

  const counts = {
    overdue:    buckets.overdue.length,
    today:      buckets.today.length,
    waiting:    buckets.waiting.length,
    no_action:  buckets.no_action.length,
    done_today: buckets.done_today.length,
    total:
      buckets.overdue.length +
      buckets.today.length +
      buckets.waiting.length +
      buckets.no_action.length,
  }

  return Response.json({ ok: true, buckets, counts })
}
