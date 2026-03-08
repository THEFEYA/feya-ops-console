'use client'

// Force server-side rendering on every request — never statically cached
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LeadTable } from '@/components/inbox/LeadTable'
import { LeadDetailPanel } from '@/components/inbox/LeadDetailPanel'
import { InboxFilterBar, type InboxFilters } from '@/components/inbox/InboxFilters'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { type NormalisedLead } from '@/lib/field-resolver'
import { buildApiUrl } from '@/lib/utils'

type TabKey = 'b2b_hot' | 'people_hot' | 'event_review' | 'extract_people'

const TABS: { key: TabKey; label: string; description: string }[] = [
  { key: 'b2b_hot', label: 'B2B горячие', description: 'inbox_b2b_hot_enriched' },
  { key: 'people_hot', label: 'Люди B2C', description: 'inbox_people_hot_enriched' },
  { key: 'event_review', label: 'Event Review', description: 'inbox_event_review_enriched' },
  { key: 'extract_people', label: 'Extract Queue', description: 'inbox_extract_people_enriched' },
]

const EMPTY_FILTERS: InboxFilters = {
  search: '',
  warmth: '',
  source: '',
  country: '',
  status: '',
  scoreMin: '',
  scoreMax: '',
}

interface ServerDebug {
  view: string
  filtersApplied: string[]
  orderUsed: string
}

interface DiagInfo {
  url: string
  // HTTP error fields
  status?: number
  statusText?: string
  responseText?: string
  // Empty-OK fields
  count?: number
  keys?: string[]
  serverDebug?: ServerDebug
}

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('b2b_hot')
  const [leadsMap, setLeadsMap] = useState<Record<TabKey, NormalisedLead[]>>({
    b2b_hot: [],
    people_hot: [],
    event_review: [],
    extract_people: [],
  })
  const [loading, setLoading] = useState<Record<TabKey, boolean>>({
    b2b_hot: true,
    people_hot: false,
    event_review: false,
    extract_people: false,
  })
  const [diagMap, setDiagMap] = useState<Record<TabKey, DiagInfo | null>>({
    b2b_hot: null,
    people_hot: null,
    event_review: null,
    extract_people: null,
  })
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_FILTERS)
  const [selectedLead, setSelectedLead] = useState<NormalisedLead | null>(null)
  const [outcomes, setOutcomes] = useState<Record<string | number, string>>({})

  const loadTab = useCallback(async (tab: TabKey) => {
    setLoading((prev) => ({ ...prev, [tab]: true }))
    setDiagMap((prev) => ({ ...prev, [tab]: null }))
    try {
      const params: Record<string, string> = { name: 'inbox', tab }
      if (filters.warmth) params.warmth = filters.warmth
      if (filters.source) params.source = filters.source
      // country is not present in all views — filtered client-side below
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      if (filters.scoreMin) params.scoreMin = filters.scoreMin
      if (filters.scoreMax) params.scoreMax = filters.scoreMax

      const url = buildApiUrl('/api/sb/query', params)
      const res = await fetch(url, { cache: 'no-store' })

      if (!res.ok) {
        const responseText = (await res.text()).slice(0, 1000)
        setDiagMap((prev) => ({
          ...prev,
          [tab]: { url, status: res.status, statusText: res.statusText, responseText },
        }))
        setLeadsMap((prev) => ({ ...prev, [tab]: [] }))
        return
      }

      const json = await res.json()
      const rows: NormalisedLead[] = json.data ?? []
      const serverDebug: ServerDebug | undefined = json._debug
      setLeadsMap((prev) => ({ ...prev, [tab]: rows }))
      setDiagMap((prev) => ({
        ...prev,
        [tab]: {
          url,
          count: rows.length,
          keys: rows.length > 0 ? Object.keys(rows[0]) : [],
          serverDebug,
        },
      }))

      // Batch-fetch latest stage for all visible leads
      if (rows.length > 0) {
        const ids = rows.map((r) => String(r.id))
        fetch(buildApiUrl('/api/actions/lead-outcome/batch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_ids: ids }),
          cache: 'no-store',
        })
          .then((r) => r.ok ? r.json() : null)
          .then((batchJson) => {
            const map: Record<string, { stage: string }> = batchJson?.map ?? {}
            if (Object.keys(map).length === 0) return
            setOutcomes((prev) => {
              const next = { ...prev }
              for (const [id, val] of Object.entries(map)) {
                next[id] = val.stage
              }
              return next
            })
          })
          .catch(() => {})
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading((prev) => ({ ...prev, [tab]: false }))
    }
  }, [filters])

  // Load active tab when it changes or filters change
  useEffect(() => {
    loadTab(activeTab)
  }, [activeTab, loadTab])

  // Client-side filter for search and fields that may not exist in all views
  const displayLeads = useMemo(() => {
    let leads = leadsMap[activeTab]
    if (filters.search) {
      const q = filters.search.toLowerCase()
      leads = leads.filter(
        (l) =>
          l.title?.toLowerCase().includes(q) ||
          l.url?.toLowerCase().includes(q) ||
          l.snippet?.toLowerCase().includes(q)
      )
    }
    // country may be absent in some views — apply client-side so the table is never hidden
    if (filters.country) {
      const q = filters.country.toLowerCase()
      leads = leads.filter((l) => l.country?.toLowerCase().includes(q))
    }
    return leads
  }, [leadsMap, activeTab, filters.search, filters.country])

  function handleOutcomeSet(leadId: string | number, outcome: string) {
    setOutcomes((prev) => ({ ...prev, [leadId]: outcome }))
    // Update in the leads map optimistically
    setLeadsMap((prev) => ({
      ...prev,
      [activeTab]: prev[activeTab].map((l) =>
        l.id === leadId ? { ...l, status: outcome } : l
      ),
    }))
  }

  const diag = diagMap[activeTab]

  return (
    <div className="flex gap-0 h-full animate-fade-in" style={{ height: 'calc(100vh - 104px)' }}>
      {/* Main table area */}
      <div className="flex-1 flex flex-col min-w-0 pr-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as TabKey)
            setSelectedLead(null)
          }}
        >
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} title={t.description}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <span className="text-xs text-muted-foreground">
              {displayLeads.length} лидов
            </span>
          </div>

          <div className="mb-3">
            <InboxFilterBar
              filters={filters}
              onChange={(f) => {
                setFilters(f)
                setSelectedLead(null)
              }}
            />
          </div>

          {/* HTTP error — red block */}
          {diag?.status !== undefined && (
            <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs font-mono space-y-1">
              <p className="font-semibold text-red-400">✗ Ошибка запроса</p>
              <p className="text-muted-foreground break-all">URL: {diag.url}</p>
              <p className="text-red-400">HTTP {diag.status} {diag.statusText}</p>
              {diag.responseText && (
                <pre className="text-red-300 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                  {diag.responseText}
                </pre>
              )}
            </div>
          )}

          {/* Server debug — yellow block (always shown when available) */}
          {diag?.serverDebug && (
            <div className="mb-3 rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 text-xs font-mono space-y-1">
              <p className="font-semibold text-yellow-400">⚑ Диагностика</p>
              <p className="text-muted-foreground">Таблица: {diag.serverDebug.view}</p>
              <p className="text-muted-foreground">Сортировка: {diag.serverDebug.orderUsed}</p>
              <p className="text-muted-foreground">
                Серверные фильтры: {diag.serverDebug.filtersApplied.length > 0 ? diag.serverDebug.filtersApplied.join(', ') : 'нет'}
              </p>
              <p className="text-muted-foreground">Записей: {diag.count}</p>
              {diag.keys && diag.keys.length > 0 && (
                <p className="text-muted-foreground">Поля: {diag.keys.join(', ')}</p>
              )}
            </div>
          )}

          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              {loading[t.key] ? (
                <LoadingSpinner />
              ) : (
                <LeadTable
                  leads={displayLeads}
                  selectedId={selectedLead?.id}
                  onSelect={setSelectedLead}
                  outcomes={outcomes}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Detail panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onOutcomeSet={handleOutcomeSet}
        />
      )}
    </div>
  )
}
