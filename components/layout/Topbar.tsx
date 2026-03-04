'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/flow': 'Поток / Мониторинг',
  '/inbox': 'Лиды / Инбокс',
  '/analytics': 'Аналитика',
  '/control': 'Управление',
  '/docs': 'Справка',
}

interface TopbarProps {
  pathname: string
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function Topbar({ pathname, onRefresh, isRefreshing }: TopbarProps) {
  const [now, setNow] = useState<string>('')

  useEffect(() => {
    const update = () => {
      setNow(
        new Intl.DateTimeFormat('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date())
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? 'Консоль'

  return (
    <header className="h-14 border-b border-border flex items-center px-6 gap-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <h1 className="text-sm font-semibold text-foreground flex-1">{title}</h1>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono tabular-nums">{now}</span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Обновить данные"
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md border border-border',
              'hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors',
              isRefreshing && 'text-neon-cyan border-neon-cyan/40'
            )}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            <span>Обновить</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border">
          <span className="status-dot status-dot-green" />
          <span>Online</span>
        </div>
      </div>
    </header>
  )
}
