'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Activity,
  Inbox,
  BarChart3,
  Settings2,
  BookOpen,
  Zap,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/flow', label: 'Поток', icon: Activity, hint: 'Мониторинг пайплайна' },
  { href: '/inbox', label: 'Лиды', icon: Inbox, hint: 'Инбокс лидов' },
  { href: '/analytics', label: 'Аналитика', icon: BarChart3, hint: 'Графики и KPI' },
  { href: '/control', label: 'Управление', icon: Settings2, hint: 'Запуск функций' },
  { href: '/docs', label: 'Справка', icon: BookOpen, hint: 'Документация' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-card border-r border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Zap className="w-6 h-6 text-neon-cyan" />
            <div className="absolute inset-0 blur-sm opacity-60" style={{ color: '#00e5ff' }} />
          </div>
          <div>
            <div className="font-bold text-sm tracking-widest neon-text-cyan">FEYA</div>
            <div className="text-xs text-muted-foreground leading-none">Ops Console</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.hint}
              className={cn('sidebar-item', active && 'active')}
            >
              <item.icon className={cn('w-4 h-4', active ? 'text-neon-cyan' : '')} />
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-cyan"
                  style={{ boxShadow: '0 0 6px #00e5ff' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="status-dot status-dot-green" />
            <span>Система активна</span>
          </div>
          <div className="text-xs opacity-50">v0.1.0</div>
        </div>
      </div>
    </aside>
  )
}
