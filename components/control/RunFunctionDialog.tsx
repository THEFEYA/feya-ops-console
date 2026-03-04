'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { InlineSpinner } from '@/components/shared/LoadingSpinner'
import { buildApiUrl } from '@/lib/utils'
import { Play, ChevronDown, ChevronUp } from 'lucide-react'

interface RunButton {
  id: string
  label: string
  functionName: string
  description: string
  defaultParams: Record<string, string | number | boolean>
  color: 'cyan' | 'green' | 'yellow' | 'purple' | 'red'
}

interface Props {
  button: RunButton
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const FIELD_LABELS: Record<string, string> = {
  limitTasks: 'Лимит задач',
  lookbackHours: 'Глубина поиска (часов)',
  minIntentForTask: 'Мин. интент для задачи',
  maxActorAgeDays: 'Макс. возраст актора (дней)',
  dryRun: 'Тестовый запуск (dry run)',
  limit: 'Лимит',
  offset: 'Смещение',
}

export function RunFunctionDialog({ button, open, onOpenChange, onSuccess }: Props) {
  const [params, setParams] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(button.defaultParams).map(([k, v]) => [k, String(v)]))
  )
  const [advancedJson, setAdvancedJson] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  function buildPayload(): Record<string, unknown> {
    // Start with typed params
    const payload: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(params)) {
      if (v === '') continue
      if (v === 'true') payload[k] = true
      else if (v === 'false') payload[k] = false
      else if (!isNaN(Number(v))) payload[k] = Number(v)
      else payload[k] = v
    }

    // Merge advanced JSON if provided
    if (advancedJson.trim()) {
      try {
        const adv = JSON.parse(advancedJson)
        Object.assign(payload, adv)
      } catch {
        throw new Error('Невалидный JSON в расширенных параметрах')
      }
    }

    return payload
  }

  async function handleRun() {
    setLoading(true)
    setLastResult(null)
    try {
      const payload = buildPayload()
      const res = await fetch(buildApiUrl('/api/actions/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function_name: button.functionName, payload }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(`Ошибка запуска: ${json.error ?? res.statusText}`)
        setLastResult(`Ошибка: ${json.error}`)
      } else {
        toast.success(`✓ Запуск выполнен: ${button.label}`)
        setLastResult(JSON.stringify(json.data ?? 'OK', null, 2))
        onSuccess?.()
        // Close after a short delay so user can see the result
        setTimeout(() => onOpenChange(false), 2000)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(`Ошибка: ${msg}`)
      setLastResult(`Ошибка: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const colorMap = {
    cyan: 'text-neon-cyan border-neon-cyan/40',
    green: 'text-neon-green border-neon-green/40',
    yellow: 'text-neon-yellow border-neon-yellow/40',
    purple: 'text-neon-purple border-neon-purple/40',
    red: 'text-neon-red border-neon-red/40',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={colorMap[button.color].split(' ')[0]}>
            {button.label}
          </DialogTitle>
          <DialogDescription>{button.description}</DialogDescription>
          <div className="text-xs font-mono text-muted-foreground/60 mt-1">
            fn: {button.functionName}
          </div>
        </DialogHeader>

        <div className="space-y-3 my-2">
          {Object.entries(params).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {FIELD_LABELS[key] ?? key}
              </Label>
              <Input
                value={value}
                onChange={(e) => setParams((p) => ({ ...p, [key]: e.target.value }))}
                className="h-8 text-xs font-mono"
                placeholder={String(button.defaultParams[key])}
              />
            </div>
          ))}

          {/* Advanced JSON */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Расширенные параметры (JSON)
            </button>
            {showAdvanced && (
              <Textarea
                value={advancedJson}
                onChange={(e) => setAdvancedJson(e.target.value)}
                placeholder={'{\n  "customParam": "value"\n}'}
                className="mt-2 text-xs font-mono h-28 resize-none"
              />
            )}
          </div>

          {/* Last result */}
          {lastResult && (
            <div className="bg-secondary/40 rounded-lg p-3 border border-border">
              <p className="text-[10px] text-muted-foreground mb-1">Результат:</p>
              <pre className="text-xs text-neon-green/80 overflow-x-auto whitespace-pre-wrap break-all">
                {lastResult.slice(0, 500)}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Отмена
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={loading}
            className={`gap-1.5 ${colorMap[button.color]}`}
            variant="outline"
          >
            {loading ? (
              <>
                <InlineSpinner /> Запуск…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Запустить
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { RunButton }
