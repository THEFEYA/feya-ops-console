'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { X, ExternalLink, ChevronDown, ChevronUp, ShieldAlert, FileText, Sparkles, Wand2, Clock3 } from 'lucide-react'
import { type NormalisedLead, type ActionIntentShape, type AvailableActionShape, generateLeadReasons } from '@/lib/field-resolver'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { InlineSpinner } from '@/components/shared/LoadingSpinner'
import { formatDateTime, cn, buildApiUrl } from '@/lib/utils'

interface Props {
  lead: NormalisedLead
  routeCode: 'queue' | 'inbox'
  onClose: () => void
  onRefresh?: () => void
}

type UiHint = 'pause' | 'reclassify' | null

function tone(value?: string | null) {
  const v = String(value ?? '').toLowerCase()
  if (!v) return 'outline' as const
  if (v.includes('личн') || v.includes('review') || v.includes('контрол') || v.includes('risk')) return 'red' as const
  if (v.includes('готов') || v.includes('approved') || v.includes('одоб')) return 'green' as const
  if (v.includes('сценар') || v.includes('draft') || v.includes('холод') || v.includes('нет')) return 'cyan' as const
  return 'outline' as const
}

function byActionCode(actions: AvailableActionShape[] | undefined, code: string) {
  return (actions ?? []).find((a) => a.action_code === code)
}

function byIntentCode(intents: ActionIntentShape[] | undefined, code: string) {
  return (intents ?? []).find((a) => a.action_intent_code === code)
}

export function LeadDetailPanel({ lead, routeCode, onClose, onRefresh }: Props) {
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [showExplain, setShowExplain] = useState(false)
  const [showRecommendation, setShowRecommendation] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [uiHint, setUiHint] = useState<UiHint>(null)

  const reasons = useMemo(() => generateLeadReasons(lead), [lead])
  const availableActions = lead.available_actions ?? []
  const actionIntents = lead.action_intents ?? []

  const scenario = lead.scenario_cluster_name || 'Сценарий уточняется'
  const nextBestAction = lead.next_best_action || (routeCode === 'queue'
    ? 'Нужно уточнить сценарий и выбрать первый безопасный шаг.'
    : 'Нужно оценить ответ и подготовить follow-up.')
  const recommendation = lead.recommendation_ru || 'FEYA ещё не подготовила развёрнутую рекомендацию. Сейчас важнее понять состояние объекта, выбрать безопасный следующий шаг и не перегрузить контакт.'
  const riskExplanation = lead.risk_explanation_ru || (lead.owner_control_required || lead.handoff_status
    ? 'По текущему состоянию нужен более осторожный режим работы и возможна личная проверка.'
    : 'Явного сигнала риска пока нет. Можно двигаться по сценарию без лишнего давления.')

  const canRunFirstDraft = Boolean(byActionCode(availableActions, 'action_prepare_first_draft'))
  const canRunFollowup = Boolean(byActionCode(availableActions, 'action_prepare_followup'))
  const canOpenOwnerReview = routeCode === 'queue' || lead.owner_control_required || Boolean(lead.handoff_status)

  async function runRuntime(action: 'request_first_touch_draft' | 'request_followup_draft' | 'open_owner_control_handoff') {
    setRunningAction(action)
    try {
      const res = await fetch(buildApiUrl('/api/actions/feya-runtime'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          lead_id: lead.id,
          requested_by: 'ops_console',
          handoff_reason: lead.risk_explanation_ru || note || 'Требуется личная проверка по текущему риску',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(String(json?.error || 'Не удалось выполнить действие FEYA'))
      }
      toast.success(action === 'open_owner_control_handoff' ? 'Личная проверка открыта' : 'Действие FEYA запущено')
      onRefresh?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setRunningAction(null)
    }
  }

  function runUiHint(kind: UiHint) {
    setUiHint(kind)
    if (kind === 'pause') toast.success('Кандидат на паузу отмечен в рабочем контексте экрана')
    if (kind === 'reclassify') toast.success('Кандидат на переклассификацию отмечен в рабочем контексте экрана')
  }

  return (
    <aside className="w-[420px] max-w-[42vw] min-w-[360px] border-l border-border bg-card/70 backdrop-blur-sm h-full overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground line-clamp-2">{lead.title}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="outline">{routeCode === 'queue' ? 'Очередь' : 'Входящие ответы'}</Badge>
            <Badge variant={tone(lead.stage_family_ru)}>{lead.stage_family_ru || 'Этап уточняется'}</Badge>
            <Badge variant={tone(lead.reply_state_ru)}>{lead.reply_state_ru || 'Ответа пока нет'}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0"><X className="w-4 h-4" /></Button>
      </div>

      <div className="p-4 space-y-4">
        {(lead.owner_control_required || lead.handoff_status || lead.risk_explanation_ru) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-300" />
              <div>
                <div className="text-sm font-medium text-foreground">Видимость owner-control</div>
                <div className="text-xs text-muted-foreground mt-1">{riskExplanation}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-secondary/25 p-3">
            <div className="text-[11px] text-muted-foreground">Сценарий</div>
            <div className="text-sm font-medium mt-1">{scenario}</div>
          </div>
          <div className="rounded-xl border border-border bg-secondary/25 p-3">
            <div className="text-[11px] text-muted-foreground">Режим</div>
            <div className="text-sm font-medium mt-1">{lead.execution_mode_ru || 'Режим уточняется'}</div>
          </div>
          <div className="rounded-xl border border-border bg-secondary/25 p-3 col-span-2">
            <div className="text-[11px] text-muted-foreground">Следующий лучший шаг</div>
            <div className="text-sm font-medium mt-1">{nextBestAction}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
          <div className="text-sm font-medium text-foreground">Доступные действия</div>
          <div className="flex flex-wrap gap-2">
            {canRunFirstDraft && (
              <Button size="sm" className="gap-1.5" onClick={() => runRuntime('request_first_touch_draft')} disabled={runningAction !== null}>
                {runningAction === 'request_first_touch_draft' ? <InlineSpinner /> : <Wand2 className="w-3.5 h-3.5" />}
                Подготовить первый драфт
              </Button>
            )}
            {canRunFollowup && (
              <Button size="sm" className="gap-1.5" onClick={() => runRuntime('request_followup_draft')} disabled={runningAction !== null}>
                {runningAction === 'request_followup_draft' ? <InlineSpinner /> : <Wand2 className="w-3.5 h-3.5" />}
                Подготовить follow-up
              </Button>
            )}
            {canOpenOwnerReview && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => runRuntime('open_owner_control_handoff')} disabled={runningAction !== null}>
                {runningAction === 'open_owner_control_handoff' ? <InlineSpinner /> : <ShieldAlert className="w-3.5 h-3.5" />}
                Открыть личную проверку
              </Button>
            )}
            {byActionCode(availableActions, 'action_explain_next_step') && (
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setShowExplain((v) => !v)}>
                <FileText className="w-3.5 h-3.5" /> Почему такой следующий шаг
              </Button>
            )}
            {byActionCode(availableActions, 'action_show_agent_recommendation') && (
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setShowRecommendation((v) => !v)}>
                <Sparkles className="w-3.5 h-3.5" /> Показать рекомендацию FEYA
              </Button>
            )}
            {byActionCode(availableActions, 'action_mark_pause_candidate') && (
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => runUiHint('pause')}>
                <Clock3 className="w-3.5 h-3.5" /> Отметить как паузу
              </Button>
            )}
            {byActionCode(availableActions, 'action_mark_reclassify_candidate') && (
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => runUiHint('reclassify')}>
                <Clock3 className="w-3.5 h-3.5" /> Отметить на переклассификацию
              </Button>
            )}
          </div>
          {uiHint && (
            <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">
              {uiHint === 'pause'
                ? 'FEYA показывает этот объект как кандидата на паузу: сейчас полезнее снизить давление, не ускорять касание и дождаться более сильного сигнала.'
                : 'FEYA показывает этот объект как кандидата на переклассификацию: текущий fit ослаблен, и объект может потребовать другого сценария или другой линии оффера.'}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <div className="text-sm font-medium text-foreground">Коротко сейчас</div>
          <div className="mt-2 grid gap-2 text-xs">
            <div><span className="text-muted-foreground">Операторский статус:</span> <span className="text-foreground">{lead.operator_status_ru || 'Статус уточняется'}</span></div>
            <div><span className="text-muted-foreground">Состояние строки:</span> <span className="text-foreground">{lead.queue_row_state_ru || '—'}</span></div>
            <div><span className="text-muted-foreground">Источник:</span> <span className="text-foreground">{lead.source || '—'}</span></div>
            {lead.desired_response && <div><span className="text-muted-foreground">Ожидаемый ответ:</span> <span className="text-foreground">{lead.desired_response}</span></div>}
            {lead.framework_cta_mode && <div><span className="text-muted-foreground">CTA-логика:</span> <span className="text-foreground">{lead.framework_cta_mode}</span></div>}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <button className="w-full flex items-center justify-between text-left" onClick={() => setShowRecommendation((v) => !v)}>
            <span className="text-sm font-medium text-foreground">Рекомендация FEYA</span>
            {showRecommendation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showRecommendation && (
            <div className="mt-3 space-y-3 text-xs">
              <div className="rounded-lg border border-border bg-background/60 p-3 text-foreground/90">{recommendation}</div>
              <div className="rounded-lg border border-border bg-background/60 p-3 text-muted-foreground">{riskExplanation}</div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <button className="w-full flex items-center justify-between text-left" onClick={() => setShowExplain((v) => !v)}>
            <span className="text-sm font-medium text-foreground">Почему FEYA считает это лидом</span>
            {showExplain ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showExplain && (
            <div className="mt-3 space-y-2 text-xs text-foreground/85">
              {lead.card_title_ru && <div className="rounded-lg border border-border bg-background/60 p-3"><div className="font-medium mb-1">{lead.card_title_ru}</div><div className="text-muted-foreground">{lead.card_description_ru || 'Карточка FEYA помогает объяснить текущую decision-surface.'}</div></div>}
              {reasons.map((reason) => (
                <div key={reason} className="rounded-lg border border-border bg-background/60 px-3 py-2">{reason}</div>
              ))}
              {(lead.snippet || lead.evidence_text) && <div className="rounded-lg border border-border bg-background/60 p-3 text-muted-foreground">{lead.evidence_text || lead.snippet}</div>}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
          <div className="text-sm font-medium text-foreground">Черновик и контроль</div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={tone(lead.draft_status)}>Драфт: {lead.draft_status || 'ещё не подготовлен'}</Badge>
            <Badge variant={tone(lead.approval_status)}>Review: {lead.approval_status || 'не требуется'}</Badge>
            <Badge variant={tone(lead.handoff_status)}>Owner-control: {lead.handoff_status || 'не открыт'}</Badge>
          </div>
          {lead.framework_objective && <div className="text-xs text-muted-foreground">Цель касания: {lead.framework_objective}</div>}
          {lead.handoff_summary_ru && <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">{lead.handoff_summary_ru}</div>}
          {lead.draft_text && <Textarea value={lead.draft_text} readOnly className="min-h-[140px] text-xs" />}
          {lead.reasoning_text && <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">{lead.reasoning_text}</div>}
        </div>

        {lead.url && (
          <a href={lead.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-neon-cyan hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /> Открыть источник
          </a>
        )}

        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <button className="w-full flex items-center justify-between text-left" onClick={() => setShowDiagnostics((v) => !v)}>
            <span className="text-sm font-medium text-foreground">Диагностика экрана</span>
            {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showDiagnostics && (
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div>Binding: {lead.binding_title_ru || '—'}</div>
              <div>Panel slot: {lead.panel_slot || '—'}</div>
              <div>Lead ID: {String(lead.id)}</div>
              <div>Последнее замечание оператора:</div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[90px] text-xs" placeholder="Короткая заметка для текущего рабочего контекста" />
              {lead.created_at && <div>Дата объекта: {formatDateTime(lead.created_at)}</div>}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
