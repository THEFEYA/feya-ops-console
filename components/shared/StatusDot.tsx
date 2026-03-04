import { cn } from '@/lib/utils'

type StatusType = 'ok' | 'running' | 'error' | 'warn' | 'idle' | 'queued'

const DOT_MAP: Record<StatusType, string> = {
  ok: 'status-dot-green',
  running: 'status-dot-cyan',
  error: 'status-dot-red',
  warn: 'status-dot-yellow',
  idle: 'status-dot-gray',
  queued: 'status-dot-yellow',
}

const LABEL_MAP: Record<StatusType, string> = {
  ok: 'OK',
  running: 'Работает',
  error: 'Ошибка',
  warn: 'Предупреждение',
  idle: 'Неактивен',
  queued: 'В очереди',
}

interface StatusDotProps {
  status: StatusType | string
  showLabel?: boolean
  className?: string
}

function resolveStatus(s: string): StatusType {
  const lower = s.toLowerCase()
  if (['ok', 'success', 'done', 'completed'].includes(lower)) return 'ok'
  if (['running', 'active', 'processing', 'in_progress'].includes(lower)) return 'running'
  if (['error', 'failed', 'failure'].includes(lower)) return 'error'
  if (['warn', 'warning'].includes(lower)) return 'warn'
  if (['queued', 'pending'].includes(lower)) return 'queued'
  return 'idle'
}

export function StatusDot({ status, showLabel, className }: StatusDotProps) {
  const resolved = resolveStatus(status)
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('status-dot', DOT_MAP[resolved])} />
      {showLabel && (
        <span className="text-xs text-muted-foreground">{LABEL_MAP[resolved]}</span>
      )}
    </span>
  )
}
