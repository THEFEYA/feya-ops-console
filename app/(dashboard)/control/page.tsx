'use client'

import { useState } from 'react'
import { RunButtons } from '@/components/control/RunButtons'
import { RecentRunsTable } from '@/components/control/RecentRunsTable'
import { NeonCard } from '@/components/shared/NeonCard'
import { InfoCircle } from '@/components/shared/InfoCircle'

export default function ControlPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  function handleRunSuccess() {
    // Trigger refresh of the runs table after a delay
    setTimeout(() => setRefreshTrigger((n) => n + 1), 2000)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Run Now section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">Запуск функций</h2>
          <InfoCircle
            tooltip="Нажмите на кнопку функции, задайте параметры и запустите. Вызывает Supabase Edge Function."
          />
        </div>
        <RunButtons onRunSuccess={handleRunSuccess} />
      </section>

      {/* Warning */}
      <NeonCard glow="yellow" className="flex items-start gap-3">
        <span className="text-neon-yellow text-lg mt-0.5">⚠</span>
        <div>
          <p className="text-sm font-medium text-neon-yellow">Внимание</p>
          <p className="text-xs text-muted-foreground mt-1">
            Все запуски немедленно выполняются на бэкенде Supabase. Убедитесь, что параметры верны
            перед нажатием «Запустить». Некоторые функции могут потреблять API-квоту.
          </p>
        </div>
      </NeonCard>

      {/* Recent runs */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">История прогонов и ошибки</h2>
          <InfoCircle tooltip="Последние 200 прогонов из таблицы runs. Автообновление после каждого запуска." />
        </div>
        <RecentRunsTable refreshTrigger={refreshTrigger} />
      </section>

      {/* Cron schedule */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">Расписание (Cron)</h2>
        </div>
        <NeonCard>
          <p className="text-sm text-muted-foreground">
            Таблица <code className="text-neon-cyan">cron.job</code> недоступна через Supabase JS client
            (требует прямого подключения к pg или pg_cron расширения).
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Для просмотра расписания используйте Supabase Dashboard → Database → Extensions → pg_cron,
            или подключитесь через psql.
          </p>
        </NeonCard>
      </section>
    </div>
  )
}
