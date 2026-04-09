'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { LeadTable } from '@/components/inbox/LeadTable'
import { LeadDetailPanel } from '@/components/inbox/LeadDetailPanel'
import { InboxFilterBar, type InboxFilters } from '@/components/inbox/InboxFilters'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { type NormalisedLead } from '@/lib/field-resolver'
import { buildApiUrl } from '@/lib/utils'

type TabKey = 'queue' | 'inbox'

const TABS: { key: TabKey; label: string; description: string }[] = [
  { key: 'queue', label: 'Очередь', description: 'Главный queue/workspace-first operator surface' },
  { key: 'inbox', label: 'Входящие ответы', description: 'Ответы и follow-up контекст' },
]

const EMPTY_FILTERS: InboxFilters = {
  search: '',
  source: '',
  status: '',
  country: '',
  scenario: '',
  mode: '',
}

interface ServerDebug {
  view: string
  filtersApplied: string[]
  orderUsed: string
}

interface DiagInfo {
  url: string
  status?: number
  statusText?: string
  responseText?: string
  count?: number
  serverDebug?: ServerDebug
}

function lower(value?: string | null) {
  return String(value ?? '').toLowerCase()
}

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('queue')
  const [leadsMap, setLeadsMap] = useState<Record<TabKey, NormalisedLead[]>>({ queue: [], inbox: [] })
  const [loading, setLoading] = useState<Record<TabKey, boolean>>({ queue: true, inbox: false })
  const [diagMap, setDiagMap] = useState<Record<TabKey, DiagInfo | null>>({ queue: null, inbox: null })
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_FILTERS)
  const [selectedRow, setSelectedRow] = useState<NormalisedLead | null>(null)
  const [detailLead, setDetailLead] = useState<NormalisedLead | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  const loadTab = useCallback(async (tab: TabKey) => {
    setLoading((prev) => ({ ...prev, [tab]: true }))
    setDiagMap((prev) => ({ ...prev, [tab]: null }))
    try {
      const url = buildApiUrl('/api/sb/query', { name: 'inbox', tab, limit: '150' })
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        const responseText = (await res.text()).slice(0, 1000)
        setDiagMap((prev) => ({ ...prev, [tab]: { url, status: res.status, statusText: res.statusText, responseText } }))
        setLeadsMap((prev) => ({ ...prev, [tab]: [] }))
        return
      }
      const json = await res.json()
      const rows: NormalisedLead[] = json.data ?? []
      setLeadsMap((prev) => ({ ...prev, [tab]: rows }))
      setDiagMap((prev) => ({
        ...prev,
        [tab]: {
          url,
          count: rows.length,
          serverDebug: json._debug,
        },
      }))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading((prev) => ({ ...prev, [tab]: false }))
    }
  }, [])

  const loadDetail = useCallback(async (row: NormalisedLead | null, route: TabKey) => {
    if (!row) {
      setDetailLead(null)
      return
    }
    setSelectedRow(row)
    setDetailLoading(true)
    try {
      const url = buildApiUrl('/api/sb/query', {
        name: 'workspace_detail',
        lead_id: String(row.id),
        route,
      })
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        setDetailLead(row)
        return
      }
      const json = await res.json()
      const data = json.data as NormalisedLead | null
      setDetailLead(data ? { ...row, ...data, _raw: { ...(row._raw ?? {}), ...(data._raw ?? {}) } } : row)
    } catch (e) {
      console.error(e)
      setDetailLead(row)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTab(activeTab)
  }, [activeTab, loadTab])

  const rawLeads = leadsMap[activeTab]
  const displayLeads = useMemo(() => {
    return rawLeads.filter((lead) => {
      if (filters.search) {
        const q = lower(filters.search)
        const hay = [lead.title, lead.business_name, lead.snippet, lead.source, lead.scenario_cluster_name].map(lower).join(' ')
        if (!hay.includes(q)) return false
      }
      if (filters.source && !lower(lead.source).includes(lower(filters.source))) return false
      if (filters.country && !lower(lead.country).includes(lower(filters.country))) return false
      if (filters.scenario && !lower(lead.scenario_cluster_name).includes(lower(filters.scenario))) return false
      if (filters.mode && !lower(lead.execution_mode_ru).includes(lower(filters.mode))) return false
      if (filters.status) {
        const stateHay = [lead.queue_row_state_ru, lead.operator_status_ru, lead.reply_state_ru, lead.status].map(lower).join(' ')
        if (!stateHay.includes(lower(filters.status))) return false
      }
      return true
    })
  }, [rawLeads, filters])

  const summary = useMemo(() => {
    const list = displayLeads
    return {
      total: list.length,
      withDraft: list.filter((l) => Boolean(l.draft_status)).length,
      review: list.filter((l) => Boolean(l.approval_status) || Boolean(l.handoff_status)).length,
      ownerSensitive: list.filter((l) => Boolean(l.owner_control_required) || Boolean(l.handoff_status)).length,
    }
  }, [displayLeads])

  const diag = diagMap[activeTab]

  return (
    <div className="flex gap-0 h-full animate-fade-in" style={{ height: 'calc(100vh - 104px)' }}>
      <div className="flex-1 flex flex-col min-w-0 pr-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as TabKey)
            setSelectedRow(null)
            setDetailLead(null)
          }}
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="text-lg font-semibold text-foreground">Очередь / Рабочее место</div>
              <div className="text-xs text-muted-foreground mt-1">FEYA queue/workspace-first operator surface без декоративного dashboard.</div>
            </div>
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} title={t.description}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-border bg-secondary/20 p-3"><div className="text-[11px] text-muted-foreground">В работе сейчас</div><div className="text-2xl font-semibold mt-1">{summary.total}</div></div>
            <div className="rounded-xl border border-border bg-secondary/20 p-3"><div className="text-[11px] text-muted-foreground">Есть драфт</div><div className="text-2xl font-semibold mt-1">{summary.withDraft}</div></div>
            <div className="rounded-xl border border-border bg-secondary/20 p-3"><div className="text-[11px] text-muted-foreground">Review / контроль</div><div className="text-2xl font-semibold mt-1">{summary.review}</div></div>
            <div className="rounded-xl border border-border bg-secondary/20 p-3"><div className="text-[11px] text-muted-foreground">Owner-sensitive</div><div className="text-2xl font-semibold mt-1">{summary.ownerSensitive}</div></div>
          </div>

          <div className="mb-3 rounded-xl border border-border bg-secondary/15 px-3 py-2 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">{activeTab === 'queue' ? 'Главный режим: оператор видит сценарий, следующий шаг и контрольный контекст до запуска действия.' : 'Режим follow-up: здесь остаются ответы и сценарии, где нужен последующий шаг.'}</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{diag?.count ?? rawLeads.length} объектов</Badge>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowDiagnostics((v) => !v)}>{showDiagnostics ? 'Скрыть диагностику' : 'Показать диагностику'}</Button>
            </div>
          </div>

          {showDiagnostics && diag && (
            <div className="mb-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
              <div>Источник данных: {diag.serverDebug?.view || '—'}</div>
              <div>Сортировка: {diag.serverDebug?.orderUsed || '—'}</div>
              <div>Фильтры сервера: {diag.serverDebug?.filtersApplied?.join(', ') || 'нет'}</div>
            </div>
          )}

          <div className="mb-3">
            <InboxFilterBar filters={filters} onChange={(f) => { setFilters(f); setSelectedRow(null); setDetailLead(null) }} />
          </div>

          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              {loading[t.key] ? (
                <LoadingSpinner />
              ) : (
                <LeadTable
                  mode={t.key}
                  leads={displayLeads}
                  selectedId={selectedRow?.id}
                  onSelect={(row) => loadDetail(row, t.key)}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {selectedRow && (
        detailLoading ? (
          <aside className="w-[420px] max-w-[42vw] min-w-[360px] border-l border-border bg-card/70 flex items-center justify-center"><LoadingSpinner /></aside>
        ) : detailLead ? (
          <LeadDetailPanel
            lead={detailLead}
            routeCode={activeTab}
            onClose={() => { setSelectedRow(null); setDetailLead(null) }}
            onRefresh={() => {
              loadTab(activeTab)
              loadDetail(selectedRow, activeTab)
            }}
          />
        ) : null
      )}
    </div>
  )
}
