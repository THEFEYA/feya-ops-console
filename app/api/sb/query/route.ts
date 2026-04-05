import { NextRequest } from 'next/server'
import { authorizeRequest, unauthorizedResponse } from '@/lib/auth'
import {
  getKpiToday,
  getInbox,
  getRunsRecent,
  getTasksStats,
  getRecentErrors,
  getPipelineNodeStats,
  getLeadAnalytics,
  getLeadAnalyticsRollup,
  getLeadAnalyticsRollup2,
  getKpiTodayCounts,
  getLeadExplainRu,
  getUiTermsRu,
  getSchemaKeys,
  getSourceFunnelDaily,
  getFunnelBySourceEntity,
  getLeadCurrentStage,
  getLeadEverStage,
  getStageTransitions,
  type InboxTab,
} from '@/lib/api/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_QUERIES = [
  'kpi_today',
  'kpi_today_counts',
  'v_kpi_today',
  'inbox',
  'runs_recent',
  'tasks_stats',
  'recent_errors',
  'pipeline_stats',
  'lead_analytics',
  'lead_analytics_rollup',
  'lead_analytics_rollup2',
  'lead_explain_ru',
  'ui_terms_ru',
  'schema_keys',
  'v_source_funnel_daily',
  'v_funnel_by_source_entity',
  'v_lead_current_stage',
  'v_lead_ever_stage',
  'v_stage_transitions',
] as const

type QueryName = (typeof ALLOWED_QUERIES)[number]

function toNumber(value: string | null, fallback: number): number {
  if (value === null || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { error: 'Server misconfiguration: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    )
  }

  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  const rawName = req.nextUrl.searchParams.get('name')
  const name = rawName as QueryName | null
  if (!name || !ALLOWED_QUERIES.includes(name)) {
    return Response.json({ error: `Unknown query: ${rawName}` }, { status: 400 })
  }

  try {
    let data: unknown

    switch (name) {
      case 'kpi_today':
      case 'v_kpi_today':
        data = await getKpiToday()
        break

      case 'inbox': {
        const tab = (req.nextUrl.searchParams.get('tab') ?? 'b2b_hot') as InboxTab
        const opts = {
          limit: toNumber(req.nextUrl.searchParams.get('limit'), 200),
          scoreMin: req.nextUrl.searchParams.get('scoreMin') ? toNumber(req.nextUrl.searchParams.get('scoreMin'), 0) : undefined,
          scoreMax: req.nextUrl.searchParams.get('scoreMax') ? toNumber(req.nextUrl.searchParams.get('scoreMax'), 0) : undefined,
          warmth: req.nextUrl.searchParams.get('warmth') ?? undefined,
          source: req.nextUrl.searchParams.get('source') ?? undefined,
          country: req.nextUrl.searchParams.get('country') ?? undefined,
          search: req.nextUrl.searchParams.get('search') ?? undefined,
          status: req.nextUrl.searchParams.get('status') ?? undefined,
        }
        const { rows, _debug } = await getInbox(tab, opts)
        return Response.json({ data: rows, _debug })
      }

      case 'runs_recent':
        data = await getRunsRecent(toNumber(req.nextUrl.searchParams.get('limit'), 200))
        break

      case 'tasks_stats':
        data = await getTasksStats()
        break

      case 'recent_errors':
        data = await getRecentErrors(toNumber(req.nextUrl.searchParams.get('limit'), 50))
        break

      case 'pipeline_stats':
        data = await getPipelineNodeStats()
        break

      case 'lead_analytics':
        data = await getLeadAnalytics()
        break

      case 'lead_analytics_rollup': {
        const days = toNumber(req.nextUrl.searchParams.get('limit'), 90)
        const dateFrom = req.nextUrl.searchParams.get('date_from') ?? undefined
        const dateTo = req.nextUrl.searchParams.get('date_to') ?? undefined
        data = await getLeadAnalyticsRollup(days, dateFrom, dateTo)
        break
      }

      case 'lead_analytics_rollup2': {
        const days = toNumber(req.nextUrl.searchParams.get('limit'), 90)
        const dateFrom = req.nextUrl.searchParams.get('date_from') ?? undefined
        const dateTo = req.nextUrl.searchParams.get('date_to') ?? undefined
        data = await getLeadAnalyticsRollup2(days, dateFrom, dateTo)
        break
      }

      case 'kpi_today_counts':
        data = await getKpiTodayCounts()
        break

      case 'lead_explain_ru':
        data = await getLeadExplainRu(req.nextUrl.searchParams.get('lead_id') ?? '')
        break

      case 'ui_terms_ru':
        data = await getUiTermsRu()
        break

      case 'schema_keys':
        if (process.env.NODE_ENV !== 'development') {
          return Response.json({ error: 'Only available in development' }, { status: 403 })
        }
        data = await getSchemaKeys()
        break

      case 'v_source_funnel_daily': {
        const days = toNumber(req.nextUrl.searchParams.get('limit'), 30)
        const dateFrom = req.nextUrl.searchParams.get('date_from') ?? undefined
        const dateTo = req.nextUrl.searchParams.get('date_to') ?? undefined
        data = await getSourceFunnelDaily(days, dateFrom, dateTo)
        break
      }

      case 'v_funnel_by_source_entity': {
        const days = toNumber(req.nextUrl.searchParams.get('limit'), 30)
        data = await getFunnelBySourceEntity(days)
        break
      }

      case 'v_lead_current_stage':
        data = await getLeadCurrentStage()
        break

      case 'v_lead_ever_stage':
        data = await getLeadEverStage()
        break

      case 'v_stage_transitions':
        data = await getStageTransitions()
        break

      default:
        return Response.json({ error: 'Not implemented' }, { status: 400 })
    }

    return Response.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[api/sb/query:${name}]`, message)
    return Response.json({ error: message }, { status: 500 })
  }
}
