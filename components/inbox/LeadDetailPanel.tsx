'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { X, ExternalLink, CheckCircle, Star, XCircle, FileText, Info, MessageCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { InlineSpinner } from '@/components/shared/LoadingSpinner'
import { InfoCircle } from '@/components/shared/InfoCircle'
import { type NormalisedLead, generateLeadReasons } from '@/lib/field-resolver'
import {
  formatDateTime,
  warmthColor,
  warmthLabel,
  truncate,
  buildApiUrl,
} from '@/lib/utils'

interface Props {
  lead: NormalisedLead
  onClose: () => void
  onOutcomeSet?: (leadId: string | number, outcome: string) => void
}

type StageType =
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

const STAGE_LABELS: Record<StageType, string> = {
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

const STAGE_COLORS: Record<StageType, string> = {
  shortlisted: 'text-neon-cyan border-neon-cyan/40 bg-neon-cyan/10',
  approved: 'text-neon-green border-neon-green/40 bg-neon-green/10',
  rejected: 'text-red-400 border-red-400/40 bg-red-400/10',
  qualified: 'text-blue-400 border-blue-400/40 bg-blue-400/10',
  contacted: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10',
  replied: 'text-orange-400 border-orange-400/40 bg-orange-400/10',
  meeting: 'text-purple-400 border-purple-400/40 bg-purple-400/10',
  proposal: 'text-indigo-400 border-indigo-400/40 bg-indigo-400/10',
  won: 'text-neon-green border-neon-green/60 bg-neon-green/20',
  lost: 'text-muted-foreground border-border bg-secondary/40',
}

// Module-level cache for UI terms dictionary — fetched once per page load
let uiTermsCache: Record<string, string> | null = null

export function LeadDetailPanel({ lead, onClose, onOutcomeSet }: Props) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState<StageType | null>(null)
  const [currentStage, setCurrentStage] = useState<StageType | null>(
    (lead.status as StageType) ?? null
  )
  const [stageSetAt, setStageSetAt] = useState<string | null>(null)
  // UI terms dictionary: term → ru
  const [uiTerms, setUiTerms] = useState<Record<string, string>>(uiTermsCache ?? {})
  // "Почему это лид?" accordion
  const [explainOpen, setExplainOpen] = useState(false)
  const [explainText, setExplainText] = useState<string | null>(null)
  const [explainSource, setExplainSource] = useState<'api' | 'fallback' | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)

  const reasons = generateLeadReasons(lead)

  // Load UI terms dictionary once (module-level cache)
  useEffect(() => {
    if (uiTermsCache) { setUiTerms(uiTermsCache); return }
    fetch(buildApiUrl('/api/sb/query', { name: 'ui_terms_ru' }), { cache: 'force-cache' })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!json) return
        const dict: Record<string, string> = {}
        for (const row of json.data ?? []) {
          if (row.term) dict[String(row.term).toLowerCase()] = String(row.ru ?? row.term)
        }
        uiTermsCache = dict
        setUiTerms(dict)
      })
      .catch(() => {})
  }, [])

  // Load current stage from DB when lead changes
  useEffect(() => {
    setCurrentStage((lead.status as StageType) ?? null)
    setStageSetAt(null)
    setExplainOpen(false)
    setExplainText(null)
    setExplainSource(null)

    if (!lead.id) return
    fetch(buildApiUrl('/api/actions/lead-outcome', { lead_id: String(lead.id) }), { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        const latest = json?.data?.latest
        if (latest) {
          const s = (latest.outcome ?? latest.stage) as StageType | undefined
          if (s) {
            setCurrentStage(s)
            setStageSetAt(latest.created_at ?? null)
          }
        }
      })
      .catch(() => {})
  }, [lead.id])

  async function handleExplainToggle() {
    const next = !explainOpen
    setExplainOpen(next)
    if (!next || explainText || explainLoading) return

    setExplainLoading(true)
    try {
      const res = await fetch(
        buildApiUrl('/api/sb/query', { name: 'lead_explain_ru', lead_id: String(lead.id) }),
        { cache: 'no-store' }
      )
      if (res.ok) {
        const json = await res.json()
        const d = json.data
        const text = d?.ru_explain ?? d?.ru_summary
        if (text) {
          setExplainText(text)
          setExplainSource('api')
        } else {
          const contactStr = lead.contact_path ?? lead.business_website ?? lead.business_phone
          const amenityRu = lead.amenity
            ? (uiTermsCache?.[`amenity:${lead.amenity}`.toLowerCase()]
                ?? uiTermsCache?.[lead.amenity.toLowerCase()]
                ?? lead.amenity)
            : null
          const parts = [
            contactStr && `Контакт найден: ${contactStr}`,
            lead.business_name && `Компания: ${lead.business_name}`,
            amenityRu && `Тип объекта (OSM): ${amenityRu}`,
            lead.match_terms?.length && `Совпавшие триггеры: ${lead.match_terms.join(', ')}`,
            lead.evidence_text && `Доказательства: ${lead.evidence_text.slice(0, 300)}`,
            lead.snippet && `Контекст из источника: «${lead.snippet.slice(0, 200)}»`,
          ].filter(Boolean)
          setExplainText(parts.length > 0 ? parts.join('\n\n') : 'Дополнительное пояснение отсутствует.')
          setExplainSource('fallback')
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setExplainLoading(false)
    }
  }

  async function handleStage(stage: StageType) {
    // Optimistic update
    const prevStage = currentStage
    const prevSetAt = stageSetAt
    setCurrentStage(stage)
    setStageSetAt(new Date().toISOString())
    setLoading(stage)

    try {
      const res = await fetch(buildApiUrl('/api/actions/lead-outcome'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, stage, note: note || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        // Rollback
        setCurrentStage(prevStage)
        setStageSetAt(prevSetAt)
        toast.error(`Ошибка: ${json.error ?? res.statusText}`)
      } else {
        toast.success(`Стадия: ${STAGE_LABELS[stage]}`)
        onOutcomeSet?.(lead.id, stage)
      }
    } catch {
      setCurrentStage(prevStage)
      setStageSetAt(prevSetAt)
      toast.error('Сетевая ошибка при установке стадии')
    } finally {
      setLoading(null)
    }
  }

  const scorePercent = lead.score != null ? Math.min(100, lead.score) : null

  return (
    <aside className="w-[400px] flex-shrink-0 glass-card border-l border-border flex flex-col overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2" title={lead.title}>
            {lead.title}
          </h3>
          {lead.url && (
            <a
              href={lead.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-neon-cyan/70 hover:text-neon-cyan flex items-center gap-1 mt-1 truncate"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{lead.domain ?? lead.url}</span>
            </a>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Scores — with tooltip hints */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {scorePercent != null && (
            <div className="glass-card rounded-lg p-2 relative">
              <div className="absolute top-1 right-1">
                <InfoCircle tooltip="Скоринг лида (0–100): взвешенная сумма intent_score, reach_score и quality_score. Значение ≥ 70 — высокий приоритет." />
              </div>
              <div className="text-2xl font-bold font-mono text-neon-cyan">{scorePercent}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Скор</div>
            </div>
          )}
          {lead.warmth && (
            <div className="glass-card rounded-lg p-2 relative">
              <div className="absolute top-1 right-1">
                <InfoCircle tooltip="Интент (warmth): горячий — явный запрос/покупка; тёплый — косвенный интерес; холодный — слабый сигнал." />
              </div>
              <div className={`text-sm font-semibold ${warmthColor(lead.warmth)}`}>
                {warmthLabel(lead.warmth)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Интент</div>
            </div>
          )}
          {lead.reach != null && (
            <div className="glass-card rounded-lg p-2 relative">
              <div className="absolute top-1 right-1">
                <InfoCircle tooltip="Охват (reach): примерная аудитория источника — подписчики, просмотры или вес площадки. Выше — шире распространение." />
              </div>
              <div className="text-lg font-bold font-mono text-neon-purple">{lead.reach.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Охват</div>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-1.5">
          {lead.source && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-20 flex-shrink-0">Источник:</span>
              <Badge variant="cyan">{lead.source}</Badge>
            </div>
          )}
          {lead.country && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-20 flex-shrink-0">Страна:</span>
              <span className="text-foreground">{lead.country}</span>
            </div>
          )}
          {lead.event && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-20 flex-shrink-0">Событие:</span>
              <Badge variant="purple">{lead.event}</Badge>
            </div>
          )}
          {lead.created_at && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-20 flex-shrink-0">Дата:</span>
              <span className="text-foreground">{formatDateTime(lead.created_at)}</span>
            </div>
          )}
        </div>

        {/* Contact — primary CTA; B2B fallback when contact_path absent */}
        {(lead.contact_path || lead.username || lead.business_website || lead.business_phone) && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" /> Как связаться
            </p>
            <div className="space-y-1.5">
              {lead.contact_path && (
                <a
                  href={lead.contact_path.startsWith('http') ? lead.contact_path : undefined}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg px-3 py-2 hover:bg-neon-cyan/20 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-neon-cyan flex-shrink-0" />
                  <span className="text-neon-cyan font-medium truncate">{lead.contact_path}</span>
                </a>
              )}
              {/* B2B website fallback */}
              {!lead.contact_path && lead.business_website && (
                <a
                  href={lead.business_website.startsWith('http') ? lead.business_website : `https://${lead.business_website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg px-3 py-2 hover:bg-neon-cyan/20 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-neon-cyan flex-shrink-0" />
                  <span className="text-neon-cyan font-medium truncate">{lead.business_website}</span>
                </a>
              )}
              {/* B2B phone */}
              {lead.business_phone && (
                <a href={`tel:${lead.business_phone}`}
                  className="flex items-center gap-2 text-xs bg-neon-green/10 border border-neon-green/30 rounded-lg px-3 py-2 hover:bg-neon-green/20 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-neon-green flex-shrink-0" />
                  <span className="text-neon-green font-medium">{lead.business_phone}</span>
                </a>
              )}
              {lead.username && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-20 flex-shrink-0">Юзернейм:</span>
                  <span className="font-mono text-foreground/80">@{lead.username.replace(/^@/, '')}</span>
                </div>
              )}
              {lead.business_name && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-20 flex-shrink-0">Компания:</span>
                  <span className="text-foreground/80">{lead.business_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Snippet */}
        {lead.snippet && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Сниппет
            </p>
            <p className="text-xs text-foreground/80 leading-relaxed bg-secondary/40 rounded-lg p-3 border border-border">
              {lead.snippet}
            </p>
          </div>
        )}

        {/* Evidence */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Доказательства (почему это лид)
          </p>

          {/* B2B amenity type (OSM) — translated */}
          {lead.amenity && (
            <div className="flex items-center gap-2 mb-2 text-xs">
              <span className="text-muted-foreground">Тип места:</span>
              <Badge variant="purple">
                {uiTerms[`amenity:${lead.amenity}`.toLowerCase()]
                  ?? uiTerms[lead.amenity.toLowerCase()]
                  ?? lead.amenity}
              </Badge>
            </div>
          )}

          {/* evidence_text — primary */}
          {lead.evidence_text && (
            <p className="text-xs text-foreground/90 leading-relaxed bg-neon-green/5 border border-neon-green/20 rounded-lg p-3 mb-2">
              {lead.evidence_text}
            </p>
          )}

          {/* match_terms — translated */}
          {lead.match_terms && lead.match_terms.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {lead.match_terms.map((term, i) => {
                const ru = uiTerms[term.toLowerCase()]
                return (
                  <div key={i} className="flex flex-col items-start">
                    <Badge variant="yellow">{ru ?? term}</Badge>
                    {ru && <span className="text-[9px] text-muted-foreground/50 px-1">{term}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Heuristic reasons (fallback / supplement) */}
          {reasons.length > 0 && (
            <ul className="space-y-1 mb-2">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                  <span className="text-neon-green flex-shrink-0 mt-0.5">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1">
            {(lead.query_keyword || lead.keyword_used) && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Ключ:</span>
                <Badge variant="yellow">
                  {uiTerms[(lead.query_keyword ?? lead.keyword_used ?? '').toLowerCase()]
                    ?? lead.query_keyword
                    ?? lead.keyword_used}
                </Badge>
              </div>
            )}
            {lead.query_purpose && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Цель запроса:</span>
                <span className="text-foreground/70">{lead.query_purpose}</span>
              </div>
            )}
            {lead.query_string && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Запрос:</span>
                <span className="font-mono text-neon-cyan/70">{truncate(lead.query_string, 50)}</span>
              </div>
            )}
            {lead.source_entity && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Сущность:</span>
                <span>{lead.source_entity}</span>
              </div>
            )}
            {lead.blocked_reason && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Блок:</span>
                <span className="text-red-400">{lead.blocked_reason}</span>
              </div>
            )}
          </div>
        </div>

        {/* "Почему это лид?" accordion — loads ru_explain */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={handleExplainToggle}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-secondary/40 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              {explainLoading
                ? <InlineSpinner />
                : <Info className="w-3.5 h-3.5 text-neon-cyan" />}
              Почему это лид? (подробно)
            </span>
            {explainOpen
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {explainOpen && (
            <div className="px-3 pb-3 pt-1 text-xs leading-relaxed">
              {explainLoading ? (
                <p className="text-muted-foreground">Загрузка…</p>
              ) : explainText ? (
                <>
                  <p className="text-foreground/85 whitespace-pre-wrap">{explainText}</p>
                  {explainSource === 'fallback' && (
                    <p className="text-muted-foreground/50 mt-2 text-[10px]">
                      * Пояснение сформировано из доступных полей (ru_explain отсутствует)
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Данные недоступны</p>
              )}
            </div>
          )}
        </div>

        {/* Note */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Заметка</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Добавить заметку (будет сохранена при установке стадии)…"
            className="text-xs h-20 resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-3">
        {/* Current stage pill */}
        {currentStage && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${STAGE_COLORS[currentStage]}`}>
            <span className="font-medium">Стадия: {STAGE_LABELS[currentStage]}</span>
            {stageSetAt && (
              <span className="ml-auto flex items-center gap-1 text-[10px] opacity-60">
                <Clock className="w-3 h-3" />
                {formatDateTime(stageSetAt)}
              </span>
            )}
          </div>
        )}

        {/* Group 1: Decision */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Решение</p>
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              variant="neon-green"
              size="sm"
              onClick={() => handleStage('approved')}
              disabled={loading !== null}
              className={`text-xs ${currentStage === 'approved' ? 'ring-1 ring-neon-green' : ''}`}
            >
              {loading === 'approved' ? <InlineSpinner className="mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
              Одобрить
            </Button>
            <Button
              variant="neon"
              size="sm"
              onClick={() => handleStage('shortlisted')}
              disabled={loading !== null}
              className={`text-xs ${currentStage === 'shortlisted' ? 'ring-1 ring-neon-cyan' : ''}`}
            >
              {loading === 'shortlisted' ? <InlineSpinner className="mr-1" /> : <Star className="w-3 h-3 mr-1" />}
              Шортлист
            </Button>
            <Button
              variant="neon-red"
              size="sm"
              onClick={() => handleStage('rejected')}
              disabled={loading !== null}
              className={`text-xs ${currentStage === 'rejected' ? 'ring-1 ring-red-400' : ''}`}
            >
              {loading === 'rejected' ? <InlineSpinner className="mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
              Отклонить
            </Button>
          </div>
        </div>

        {/* Group 2: Pipeline progress */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Прогресс</p>
          <div className="grid grid-cols-4 gap-1">
            {(['qualified', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost'] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleStage(s)}
                disabled={loading !== null}
                className={`px-1.5 py-1 rounded border text-[10px] font-medium transition-colors disabled:opacity-50 ${
                  currentStage === s
                    ? STAGE_COLORS[s]
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                }`}
              >
                {loading === s ? '...' : STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
