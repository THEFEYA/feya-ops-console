'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, ExternalLink, CheckCircle, Star, XCircle, FileText, Info, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { InlineSpinner } from '@/components/shared/LoadingSpinner'
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

type OutcomeType = 'approved' | 'shortlisted' | 'rejected'

export function LeadDetailPanel({ lead, onClose, onOutcomeSet }: Props) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState<OutcomeType | null>(null)
  const [currentOutcome, setCurrentOutcome] = useState<OutcomeType | null>(
    (lead.status as OutcomeType) ?? null
  )

  const reasons = generateLeadReasons(lead)

  async function handleOutcome(outcome: OutcomeType) {
    setLoading(outcome)
    try {
      const token = typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('t') ?? sessionStorage.getItem('feya_token') ?? '')
        : ''

      const res = await fetch(buildApiUrl('/api/actions/lead-outcome'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, outcome, meta: { note: note || undefined } }),
      })

      const json = await res.json()

      if (!res.ok) {
        toast.error(`Ошибка: ${json.error ?? res.statusText}`)
      } else {
        toast.success(`Исход установлен: ${outcomeLabel(outcome)}`)
        setCurrentOutcome(outcome)
        onOutcomeSet?.(lead.id, outcome)
      }
    } catch (e) {
      toast.error('Сетевая ошибка при установке исхода')
    } finally {
      setLoading(null)
    }
  }

  function outcomeLabel(o: OutcomeType): string {
    return { approved: 'Одобрен', shortlisted: 'В шортлист', rejected: 'Отклонён' }[o]
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
        {/* Scores */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {scorePercent != null && (
            <div className="glass-card rounded-lg p-2">
              <div className="text-2xl font-bold font-mono text-neon-cyan">{scorePercent}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Скор</div>
            </div>
          )}
          {lead.warmth && (
            <div className="glass-card rounded-lg p-2">
              <div className={`text-sm font-semibold ${warmthColor(lead.warmth)}`}>
                {warmthLabel(lead.warmth)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Интент</div>
            </div>
          )}
          {lead.reach != null && (
            <div className="glass-card rounded-lg p-2">
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

        {/* Contact — primary CTA when contact_path is available */}
        {(lead.contact_path || lead.username) && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" /> Как связаться
            </p>
            <div className="space-y-1.5">
              {lead.contact_path && (
                <a
                  href={lead.contact_path.startsWith('http') ? lead.contact_path : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg px-3 py-2 hover:bg-neon-cyan/20 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-neon-cyan flex-shrink-0" />
                  <span className="text-neon-cyan font-medium truncate">{lead.contact_path}</span>
                </a>
              )}
              {lead.username && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-20 flex-shrink-0">Юзернейм:</span>
                  <span className="font-mono text-foreground/80">@{lead.username.replace(/^@/, '')}</span>
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

          {/* Primary: evidence_text from enriched view */}
          {lead.evidence_text && (
            <p className="text-xs text-foreground/90 leading-relaxed bg-neon-green/5 border border-neon-green/20 rounded-lg p-3 mb-2">
              {lead.evidence_text}
            </p>
          )}

          {/* Match terms */}
          {lead.match_terms && lead.match_terms.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {lead.match_terms.map((term, i) => (
                <Badge key={i} variant="yellow">{term}</Badge>
              ))}
            </div>
          )}

          {/* Heuristic reasons — shown as fallback or supplement */}
          {(!lead.evidence_text || reasons.length > 0) && (
            <ul className="space-y-1">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                  <span className="text-neon-green flex-shrink-0 mt-0.5">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 space-y-1">
            {(lead.query_keyword || lead.keyword_used) && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Ключ:</span>
                <Badge variant="yellow">{lead.query_keyword ?? lead.keyword_used}</Badge>
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

        {/* Note */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Заметка</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Добавить заметку (будет сохранена в meta при установке исхода)…"
            className="text-xs h-20 resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        {currentOutcome && (
          <div className="text-xs text-center text-muted-foreground mb-2">
            Текущий статус: <span className="text-neon-cyan">{outcomeLabel(currentOutcome)}</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="neon-green"
            size="sm"
            onClick={() => handleOutcome('approved')}
            disabled={loading !== null}
            className={currentOutcome === 'approved' ? 'ring-1 ring-neon-green' : ''}
          >
            {loading === 'approved' ? <InlineSpinner className="mr-1.5" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
            Одобрить
          </Button>
          <Button
            variant="neon"
            size="sm"
            onClick={() => handleOutcome('shortlisted')}
            disabled={loading !== null}
            className={currentOutcome === 'shortlisted' ? 'ring-1 ring-neon-cyan' : ''}
          >
            {loading === 'shortlisted' ? <InlineSpinner className="mr-1.5" /> : <Star className="w-3.5 h-3.5 mr-1.5" />}
            Шортлист
          </Button>
          <Button
            variant="neon-red"
            size="sm"
            onClick={() => handleOutcome('rejected')}
            disabled={loading !== null}
            className={currentOutcome === 'rejected' ? 'ring-1 ring-neon-red' : ''}
          >
            {loading === 'rejected' ? <InlineSpinner className="mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
            Отклонить
          </Button>
        </div>
      </div>
    </aside>
  )
}
