/**
 * /debug/diagnostics — always accessible (no token required).
 * Shows env config and live Supabase counts for all inbox views + leads table.
 */
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CountRow {
  label: string
  count?: number
  error?: string
}

async function getCount(label: string, view: string): Promise<CountRow> {
  try {
    const sb = createAdminClient()
    const result = await sb.from(view).select('*', { count: 'exact', head: true })
    if (result.error) return { label, error: result.error.message }
    return { label, count: result.count ?? 0 }
  } catch (e) {
    return { label, error: String(e) }
  }
}

async function getLeadCounts() {
  try {
    const sb = createAdminClient()
    const [total, warm, src] = await Promise.all([
      sb.from('leads').select('*', { count: 'exact', head: true }),
      sb.from('leads').select('*', { count: 'exact', head: true }).not('warmth', 'is', null),
      sb.from('leads').select('*', { count: 'exact', head: true }).not('source_slug', 'is', null),
    ])
    if (total.error) return { error: total.error.message }
    return {
      total: total.count ?? 0,
      withWarmth: warm.count ?? 0,
      withSourceSlug: src.count ?? 0,
    }
  } catch (e) {
    return { error: String(e) }
  }
}

function StatusCell({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  const cls = ok === true ? 'text-green-400' : ok === false ? 'text-red-400' : 'text-white'
  return <td className={`py-1.5 px-3 font-mono text-xs ${cls}`}>{children}</td>
}

function LabelCell({ children }: { children: React.ReactNode }) {
  return <td className="py-1.5 px-3 text-muted-foreground font-mono text-xs whitespace-nowrap">{children}</td>
}

export default async function DiagnosticsPage() {
  const tokenRequired =
    (process.env.FEYA_DASH_TOKEN_REQUIRED ?? 'true').trim().toLowerCase() === 'true'
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const hasDashToken = !!process.env.FEYA_DASH_TOKEN

  let inboxCounts: CountRow[] = []
  let leadsData: { total?: number; withWarmth?: number; withSourceSlug?: number; error?: string } = {}
  let connectError: string | undefined

  if (!hasSupabaseUrl || !hasServiceKey) {
    connectError = 'Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)'
  } else {
    try {
      // Run all counts in parallel
      const [b2b, people, event, extract, leads] = await Promise.all([
        getCount('mv_inbox_b2b_hot', 'mv_inbox_b2b_hot'),
        getCount('mv_inbox_people_hot', 'mv_inbox_people_hot'),
        getCount('mv_inbox_event_review', 'mv_inbox_event_review'),
        getCount('mv_inbox_extract_people', 'mv_inbox_extract_people'),
        getLeadCounts(),
      ])
      inboxCounts = [b2b, people, event, extract]
      leadsData = leads
    } catch (e) {
      connectError = String(e)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 font-mono text-sm">
      <div>
        <h1 className="text-xl font-bold text-cyan-400 mb-1">⚙ FEYA Diagnostics</h1>
        <p className="text-xs text-muted-foreground">Доступна без токена · только для отладки.</p>
      </div>

      {/* Env config */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Конфигурация</h2>
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full">
            <tbody className="divide-y divide-white/5">
              <tr>
                <LabelCell>FEYA_DASH_TOKEN_REQUIRED</LabelCell>
                <StatusCell ok={!tokenRequired}>
                  {tokenRequired ? 'true — токен обязателен' : 'false — токен отключён ✓'}
                </StatusCell>
              </tr>
              <tr>
                <LabelCell>FEYA_DASH_TOKEN</LabelCell>
                <StatusCell ok={hasDashToken}>{hasDashToken ? '✓ задан' : '✗ не задан'}</StatusCell>
              </tr>
              <tr>
                <LabelCell>NEXT_PUBLIC_SUPABASE_URL</LabelCell>
                <StatusCell ok={hasSupabaseUrl}>{hasSupabaseUrl ? '✓ задан' : '✗ не задан'}</StatusCell>
              </tr>
              <tr>
                <LabelCell>SUPABASE_SERVICE_ROLE_KEY</LabelCell>
                <StatusCell ok={hasServiceKey}>{hasServiceKey ? '✓ задан' : '✗ не задан'}</StatusCell>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {connectError && (
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-red-400 mb-2">Ошибка подключения</h2>
          <pre className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-red-300 text-xs whitespace-pre-wrap break-all">
            {connectError}
          </pre>
        </section>
      )}

      {inboxCounts.length > 0 && (
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Inbox Views — count(*)</h2>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full">
              <tbody className="divide-y divide-white/5">
                {inboxCounts.map((c) => (
                  <tr key={c.label}>
                    <LabelCell>{c.label}</LabelCell>
                    <StatusCell ok={c.error ? false : (c.count ?? 0) > 0}>
                      {c.error ? `ERROR: ${c.error}` : c.count}
                    </StatusCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(leadsData.total !== undefined || leadsData.error) && (
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Таблица leads</h2>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            {leadsData.error ? (
              <p className="p-3 text-red-400 text-xs">ERROR: {leadsData.error}</p>
            ) : (
              <table className="w-full">
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <LabelCell>count(*)</LabelCell>
                    <StatusCell ok={(leadsData.total ?? 0) > 0}>{leadsData.total}</StatusCell>
                  </tr>
                  <tr>
                    <LabelCell>warmth IS NOT NULL</LabelCell>
                    <StatusCell ok={(leadsData.withWarmth ?? 0) > 0}>{leadsData.withWarmth}</StatusCell>
                  </tr>
                  <tr>
                    <LabelCell>source_slug IS NOT NULL</LabelCell>
                    <StatusCell ok={(leadsData.withSourceSlug ?? 0) > 0}>{leadsData.withSourceSlug}</StatusCell>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      <p className="text-[11px] text-muted-foreground pt-2">
        FEYA Ops Console · /debug/diagnostics · {new Date().toISOString()}
      </p>
    </div>
  )
}
