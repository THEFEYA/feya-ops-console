'use client'

import { useState } from 'react'
import { Bot, X, Send, Bookmark } from 'lucide-react'
import { useAnalytics } from '@/lib/analytics/context'

type RollupRow = Record<string, unknown>

interface Props {
  rows: RollupRow[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function buildContext(rows: RollupRow[], filters: { dimension: string; value: string }[]): string {
  const total = rows.reduce((s, r) => s + Number(r.leads_cnt ?? 0), 0)
  const avgScore =
    rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + Number(r.avg_score ?? 0), 0) / rows.length) * 10) / 10
      : 0
  const filterDesc =
    filters.length > 0
      ? `Активные фильтры: ${filters.map((f) => `${f.dimension}=${f.value}`).join(', ')}.`
      : 'Фильтры не активны.'

  return `Данные FEYA Analytics: ${total} лидов за период, средний score ${avgScore}. ${filterDesc} Строк в наборе: ${rows.length}.`
}

export function AiPanel({ rows }: Props) {
  const { state } = useAnalytics()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedInsights, setSavedInsights] = useState<string[]>([])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const context = buildContext(rows, state.filters)
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

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs text-muted-foreground hover:text-neon-cyan hover:border-neon-cyan/40 transition-colors"
      >
        <Bot size={13} />
        FEYA Copilot
      </button>

      {/* Slide-in panel */}
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
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            {/* Context badge */}
            <div className="px-4 py-2 border-b border-border/40 bg-secondary/20">
              <p className="text-[10px] text-muted-foreground line-clamp-2">
                {buildContext(rows, state.filters)}
              </p>
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
                  onClick={sendMessage}
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
