'use client'

import { useState } from 'react'
import { Bot, X, Send, Bookmark, FolderPlus, Lightbulb, Database } from 'lucide-react'
import { useAnalytics } from '@/lib/analytics/context'

type RollupRow = Record<string, unknown>

interface Props {
  rows: RollupRow[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function topN(rows: RollupRow[], key: string, n = 3): string {
  const sums: Record<string, number> = {}
  for (const r of rows) {
    const k = String(r[key] ?? '').trim()
    if (!k) continue
    sums[k] = (sums[k] ?? 0) + Number(r.leads_cnt ?? 0)
  }
  return Object.entries(sums)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k}(${v})`)
    .join(', ')
}

function convByDim(rows: RollupRow[], groupKey: string): string {
  const totals: Record<string, number> = {}
  const approved: Record<string, number> = {}
  for (const r of rows) {
    const k = String(r[groupKey] ?? '').trim()
    if (!k) continue
    totals[k] = (totals[k] ?? 0) + Number(r.leads_cnt ?? 0)
    approved[k] = (approved[k] ?? 0) + Number(r.approved_cnt ?? (String(r.outcome ?? '') === 'approved' ? r.leads_cnt ?? 1 : 0))
  }
  const hasConv = Object.values(approved).some((v) => v > 0)
  if (!hasConv) return ''
  return Object.entries(totals)
    .filter(([k]) => totals[k] > 0)
    .sort((a, b) => (approved[b[0]] ?? 0) / b[1] - (approved[a[0]] ?? 0) / a[1])
    .slice(0, 3)
    .map(([k]) => `${k}=${totals[k] > 0 ? Math.round(((approved[k] ?? 0) / totals[k]) * 100) : 0}%`)
    .join(', ')
}

function buildContext(rows: RollupRow[], filters: { dimension: string; value: string }[], dataOnly = false): string {
  const total = rows.reduce((s, r) => s + Number(r.leads_cnt ?? 0), 0)
  const totalCnt = rows.reduce((s, r) => s + Number(r.leads_cnt ?? 1), 0)
  const avgScore =
    totalCnt > 0
      ? Math.round((rows.reduce((s, r) => s + Number(r.avg_score ?? 0) * Number(r.leads_cnt ?? 1), 0) / totalCnt) * 10) / 10
      : 0
  const filterDesc =
    filters.length > 0
      ? `Активные фильтры: ${filters.map((f) => `${f.dimension}=${f.value}`).join(', ')}.`
      : 'Фильтры не активны.'
  const convSource = convByDim(rows, 'source_slug')
  const convEvent = convByDim(rows, 'event')

  const parts = [
    dataOnly ? 'РЕЖИМ: отвечай ТОЛЬКО по данным ниже. Если данных нет — скажи "нет данных" и предложи что добавить.' : null,
    `FEYA Analytics: ${total} лидов, средний score ${avgScore}.`,
    filterDesc,
    topN(rows, 'source_slug') && `Топ-источники: ${topN(rows, 'source_slug')}.`,
    topN(rows, 'event') && `Топ-события: ${topN(rows, 'event')}.`,
    topN(rows, 'warmth') && `Интент: ${topN(rows, 'warmth')}.`,
    convSource && `Конверсия по источнику: ${convSource}.`,
    convEvent && `Конверсия по событию: ${convEvent}.`,
    `Строк: ${rows.length}.`,
  ].filter(Boolean)

  return parts.join(' ')
}

export function AiPanel({ rows }: Props) {
  const { state, dispatch } = useAnalytics()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedInsights, setSavedInsights] = useState<string[]>([])
  const [dataOnly, setDataOnly] = useState(false)

  async function sendMessage(override?: string) {
    const text = (override ?? input).trim()
    if (!text || loading) return
    if (!override) setInput('')

    const context = buildContext(rows, state.filters, dataOnly)
    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, context, filters: state.filters }),
      })
      const json = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: json.answer ?? 'Нет ответа.' }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Ошибка соединения.' }])
    } finally {
      setLoading(false)
    }
  }

  async function saveInsight(content: string) {
    setSavedInsights((prev) => [...prev, content])
    try {
      await fetch('/api/ai/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insight: content, context: buildContext(rows, state.filters) }),
      })
    } catch {
      // best effort
    }
  }

  function saveAsPreset() {
    const name = `Пресет ${new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
    dispatch({ type: 'SAVE_PRESET', payload: { name } })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs text-muted-foreground hover:text-neon-cyan hover:border-neon-cyan/40 transition-colors"
      >
        <Bot size={13} />
        FEYA Copilot
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative flex flex-col bg-card border-l border-border shadow-2xl w-full max-w-sm h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-neon-cyan" />
                <span className="text-sm font-medium">FEYA Copilot</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Data-only mode toggle */}
                <button
                  onClick={() => setDataOnly((v) => !v)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    dataOnly
                      ? 'bg-neon-cyan/20 border-neon-cyan/40 text-neon-cyan'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title="Только данные: AI отвечает строго по данным без додумывания"
                >
                  <Database size={10} />
                  Только данные
                </button>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Context badge */}
            <div className="px-4 py-2 border-b border-border/40 bg-secondary/20">
              <p className="text-[10px] text-muted-foreground line-clamp-2">
                {buildContext(rows, state.filters, dataOnly)}
              </p>
            </div>

            {/* Quick actions */}
            <div className="px-4 py-2 border-b border-border/40 flex flex-wrap gap-1.5">
              <button
                onClick={() => sendMessage('Какой источник даёт лучшую конверсию?')}
                className="px-2 py-0.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              >
                Топ конверсия
              </button>
              <button
                onClick={() => sendMessage('Предложи следующий шаг для улучшения конверсии на основе текущих данных')}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded border border-border text-[10px] text-muted-foreground hover:text-neon-cyan hover:border-neon-cyan/40 transition-colors"
              >
                <Lightbulb size={9} />
                Следующий шаг
              </button>
              <button
                onClick={saveAsPreset}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              >
                <FolderPlus size={9} />
                Сохранить пресет
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-8">
                  Задайте вопрос по текущим данным аналитики
                </p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                      msg.role === 'user'
                        ? 'bg-neon-cyan/20 text-foreground'
                        : 'bg-secondary text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => saveInsight(msg.content)}
                        className="mt-1.5 flex items-center gap-1 text-muted-foreground hover:text-neon-cyan transition-colors"
                      >
                        <Bookmark size={10} />
                        <span className="text-[10px]">Сохранить инсайт</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-lg px-3 py-2 text-xs text-muted-foreground">
                    Анализирую...
                  </div>
                </div>
              )}
            </div>

            {/* Saved insights */}
            {savedInsights.length > 0 && (
              <div className="px-4 py-2 border-t border-border/40 max-h-24 overflow-y-auto">
                <p className="text-[10px] text-muted-foreground mb-1">Сохранённые инсайты:</p>
                {savedInsights.map((s, i) => (
                  <p key={i} className="text-[10px] text-foreground/70 truncate">• {s}</p>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Спросите о данных..."
                  className="flex-1 bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-cyan/40"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="p-2 rounded bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan disabled:opacity-40 hover:bg-neon-cyan/30 transition-colors"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
