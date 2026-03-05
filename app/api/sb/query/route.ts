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
  getSchemaKeys,
  type InboxTab,
} from '@/lib/api/queries'

// Always dynamic — never cache API responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_QUERIES = [
  'kpi_today',
  'inbox',
  'runs_recent',
  'tasks_stats',
  'recent_errors',
  'pipeline_stats',
  'lead_analytics',
  'schema_keys',
] as const

type QueryName = (typeof ALLOWED_QUERIES)[number]

export async function GET(req: NextRequest) {
  // Fail fast if service role key is missing — never fall through to anon key
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return Response.json({ error: 'NEXT_PUBLIC_SUPABASE_URL missing' }, { status: 500 })
  }

  const authorized = await authorizeRequest(req)
  if (!authorized) return unauthorizedResponse()

  const name = req.nextUrl.searchParams.get('name') as QueryName | null
  if (!name || !ALLOWED_QUERIES.includes(name)) {
    return Response.json({ error: `Unknown query: ${name}` }, { status: 400 })
  }

  try {
    let data: unknown
    let _debug: unknown | undefined

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
        const result = await getInbox(tab, opts)
        data = result.rows
        _debug = result.debug
        break
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

      case 'schema_keys':
        if (process.env.NODE_ENV !== 'development') {
          return Response.json({ error: 'Only available in development' }, { status: 403 })
        }
        data = await getSchemaKeys()
        break

      default:
        return Response.json({ error: 'Not implemented' }, { status: 400 })
    }

    const body: Record<string, unknown> = { data }
    if (_debug !== undefined) body._debug = _debug
    return Response.json(body)
  } catch (err) {
    const e = err as Error & { sbDetails?: string; sbHint?: string }
    const message = (e.message ?? String(err)).slice(0, 1000)
    const details = (e.sbDetails ?? '').slice(0, 1000) || undefined
    const hint = (e.sbHint ?? '').slice(0, 1000) || undefined
    console.error(`[api/sb/query:${name}]`, message)
    return Response.json({ error: message, details, hint }, { status: 500 })
  }
}
