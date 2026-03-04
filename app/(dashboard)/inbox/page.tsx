'use client'

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
  { key: 'b2b_hot', label: 'B2B горячие', description: 'mv_inbox_b2b_hot' },
  { key: 'people_hot', label: 'Люди B2C', description: 'mv_inbox_people_hot' },
  { key: 'event_review', label: 'Event Review', description: 'mv_inbox_event_review' },
  { key: 'extract_people', label: 'Extract Queue', description: 'mv_inbox_extract_people' },
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
  const [filters, setFilters] = useState<InboxFilters>(EMPTY_FILTERS)
  const [selectedLead, setSelectedLead] = useState<NormalisedLead | null>(null)
  const [outcomes, setOutcomes] = useState<Record<string | number, string>>({})

  const loadTab = useCallback(async (tab: TabKey) => {
    setLoading((prev) => ({ ...prev, [tab]: true }))
    try {
      const params: Record<string, string> = { name: 'inbox', tab }
      if (filters.warmth) params.warmth = filters.warmth
      if (filters.source) params.source = filters.source
      if (filters.country) params.country = filters.country
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      if (filters.scoreMin) params.scoreMin = filters.scoreMin
      if (filters.scoreMax) params.scoreMax = filters.scoreMax

      const res = await fetch(buildApiUrl('/api/sb/query', params))
      const json = await res.json()
      setLeadsMap((prev) => ({ ...prev, [tab]: json.data ?? [] }))
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

  // Client-side filter for search/score (fast path)
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
    return leads
  }, [leadsMap, activeTab, filters.search])

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
