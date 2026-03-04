'use client'

import { useState } from 'react'
import { RunFunctionDialog, type RunButton } from './RunFunctionDialog'
import {
  Search,
  MessageSquare,
  Users,
  UserSearch,
  Mail,
  MapPin,
  Globe,
  Play,
} from 'lucide-react'

const RUN_BUTTONS: (RunButton & { icon: React.ElementType })[] = [
  {
    id: 'serp',
    label: 'SERP сбор (Serper)',
    functionName: 'collector_serp_serper',
    description: 'Запустить сбор результатов поисковой выдачи через Serper API',
    defaultParams: { limitTasks: 50, lookbackHours: 24, minIntentForTask: 0.5 },
    color: 'cyan',
    icon: Search,
  },
  {
    id: 'reddit_rss',
    label: 'Reddit RSS сбор',
    functionName: 'collector_reddit_rss',
    description: 'Собрать посты из Reddit по RSS-фидам',
    defaultParams: { limitTasks: 100, lookbackHours: 48 },
    color: 'yellow',
    icon: MessageSquare,
  },
  {
    id: 'extract_reddit',
    label: 'Extract people: Reddit',
    functionName: 'extract_people_reddit',
    description: 'Извлечь профили людей из Reddit-постов и комментариев',
    defaultParams: { limitTasks: 50, maxActorAgeDays: 30 },
    color: 'green',
    icon: Users,
  },
  {
    id: 'extract_rpf',
    label: 'Extract people: RPF',
    functionName: 'extract_people_rpf',
    description: 'Извлечь профили людей через RPF-экстрактор',
    defaultParams: { limitTasks: 50, maxActorAgeDays: 30 },
    color: 'green',
    icon: UserSearch,
  },
  {
    id: 'digest',
    label: 'Собрать дневной дайджест',
    functionName: 'digest_email_daily',
    description: 'Сгенерировать и отправить ежедневный email-дайджест',
    defaultParams: { dryRun: false },
    color: 'purple',
    icon: Mail,
  },
  {
    id: 'google_places',
    label: 'Google Places сбор',
    functionName: 'collector_google_places',
    description: 'Собрать данные заведений и бизнесов через Google Places API',
    defaultParams: { limitTasks: 50, lookbackHours: 72 },
    color: 'red',
    icon: MapPin,
  },
  {
    id: 'osm',
    label: 'OSM Overpass сбор',
    functionName: 'collector_osm_overpass',
    description: 'Собрать геоданные через OpenStreetMap Overpass API',
    defaultParams: { limitTasks: 50 },
    color: 'yellow',
    icon: Globe,
  },
]

const COLOR_STYLES: Record<string, string> = {
  cyan: 'border-neon-cyan/40 hover:border-neon-cyan text-neon-cyan hover:shadow-[0_0_20px_rgba(0,229,255,0.15)]',
  green: 'border-neon-green/40 hover:border-neon-green text-neon-green hover:shadow-[0_0_20px_rgba(0,255,136,0.15)]',
  yellow: 'border-neon-yellow/40 hover:border-neon-yellow text-neon-yellow hover:shadow-[0_0_20px_rgba(255,204,0,0.15)]',
  purple: 'border-neon-purple/40 hover:border-neon-purple text-neon-purple hover:shadow-[0_0_20px_rgba(204,68,255,0.15)]',
  red: 'border-neon-red/40 hover:border-neon-red text-neon-red hover:shadow-[0_0_20px_rgba(255,51,85,0.15)]',
}

interface Props {
  onRunSuccess?: () => void
}

export function RunButtons({ onRunSuccess }: Props) {
  const [activeDialog, setActiveDialog] = useState<string | null>(null)

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {RUN_BUTTONS.map((btn) => {
          const Icon = btn.icon
          return (
            <button
              key={btn.id}
              onClick={() => setActiveDialog(btn.id)}
              className={`run-btn border-2 glass-card ${COLOR_STYLES[btn.color]} transition-all duration-300`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5" />
                <Play className="w-3 h-3 opacity-50" />
              </div>
              <div className="font-semibold text-sm leading-snug">{btn.label}</div>
              <div className="text-xs text-muted-foreground leading-snug mt-1">
                {btn.description.slice(0, 60)}{btn.description.length > 60 ? '…' : ''}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/40 mt-2">
                {btn.functionName}
              </div>
            </button>
          )
        })}
      </div>

      {/* Dialogs */}
      {RUN_BUTTONS.map((btn) => (
        <RunFunctionDialog
          key={btn.id}
          button={btn}
          open={activeDialog === btn.id}
          onOpenChange={(open) => setActiveDialog(open ? btn.id : null)}
          onSuccess={onRunSuccess}
        />
      ))}
    </>
  )
}
