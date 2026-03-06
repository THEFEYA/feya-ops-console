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
  type InboxTab,
} from '@/lib/api/queries'

// Force Node.js runtime — avoids edge environment missing process.env / Node APIs
export const runtime = 'nodejs'
// Always dynamic — never cache API responses
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
] as const

type QueryName = (typeof ALLOWED_QUERIES)[number]

export async function GET(req: NextRequest) {
  // Guard: service role key must be present before touching Supabase
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { error: 'Server misconfiguration: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    )
  }

  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  const name = req.nextUrl.searchParams.get('name') as QueryName | null
  if (!name || !ALLOWED_QUERIES.includes(name)) {
    return Response.json({ error: `Unknown query: ${name}` }, { status: 400 })
  }

  try {
    let data: unknown

    switch (name) {
      case 'kpi_today':
        data = await getKpiToday()
        break

      case 'inbox': {
        const tab = (req.nextUrl.searchParams.get('tab') ?? 'b2b_hot') as InboxTab
        const opts = {
          limit: Number(req.nextUrl.searchParams.get('limit') ?? 200),
          scoreMin: req.nextUrl.searchParams.get('scoreMin')
            ? Number(req.nextUrl.searchParams.get('scoreMin'))
            : undefined,
          scoreMax: req.nextUrl.searchParams.get('scoreMax')
            ? Number(req.nextUrl.searchParams.get('scoreMax'))
            : undefined,
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
        data = await getRunsRecent(Number(req.nextUrl.searchParams.get('limit') ?? 200))
        break

      case 'tasks_stats':
        data = await getTasksStats()
        break

      case 'recent_errors':
        data = await getRecentErrors(50)
        break

      case 'pipeline_stats':
        data = await getPipelineNodeStats()
        break

      case 'lead_analytics':
        data = await getLeadAnalytics()
        break

      case 'lead_analytics_rollup': {
        const days = req.nextUrl.searchParams.get('limit')
          ? Number(req.nextUrl.searchParams.get('limit'))
          : 90
        const dateFrom = req.nextUrl.searchParams.get('date_from') ?? undefined
        const dateTo = req.nextUrl.searchParams.get('date_to') ?? undefined
        data = await getLeadAnalyticsRollup(days, dateFrom, dateTo)
        break
      }

      case 'lead_analytics_rollup2': {
        const days2 = req.nextUrl.searchParams.get('limit')
          ? Number(req.nextUrl.searchParams.get('limit'))
          : 90
        const dateFrom2 = req.nextUrl.searchParams.get('date_from') ?? undefined
        const dateTo2 = req.nextUrl.searchParams.get('date_to') ?? undefined
        data = await getLeadAnalyticsRollup2(days2, dateFrom2, dateTo2)
        break
      }

      case 'kpi_today_counts':
        data = await getKpiTodayCounts()
        break

      case 'lead_explain_ru': {
        const leadId = req.nextUrl.searchParams.get('lead_id') ?? ''
        data = await getLeadExplainRu(leadId)
        break
      }

      case 'ui_terms_ru':
        data = await getUiTermsRu()
        break

      case 'schema_keys':
        if (process.env.NODE_ENV !== 'development') {
          return Response.json({ error: 'Only available in development' }, { status: 403 })
        }
        data = await getSchemaKeys()
        break

      // Alias: v_kpi_today is the same underlying view as kpi_today
      case 'v_kpi_today':
        data = await getKpiToday()
        break

      case 'v_source_funnel_daily': {
        const sfDays = req.nextUrl.searchParams.get('limit')
          ? Number(req.nextUrl.searchParams.get('limit'))
          : 30
        const sfFrom = req.nextUrl.searchParams.get('date_from') ?? undefined
        const sfTo = req.nextUrl.searchParams.get('date_to') ?? undefined
        data = await getSourceFunnelDaily(sfDays, sfFrom, sfTo)
        break
      }

      case 'v_funnel_by_source_entity': {
        const fbDays = req.nextUrl.searchParams.get('limit')
          ? Number(req.nextUrl.searchParams.get('limit'))
          : 30
        data = await getFunnelBySourceEntity(fbDays)
        break
      }

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
