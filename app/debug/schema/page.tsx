import { redirect } from 'next/navigation'
import { getSchemaKeys } from '@/lib/api/queries'
import { NeonCard } from '@/components/shared/NeonCard'

export default async function DebugSchemaPage() {
  if (process.env.NODE_ENV !== 'development') {
    redirect('/')
  }

  const schema = await getSchemaKeys()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-neon-cyan mb-2">Debug: Schema Keys</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Первый ряд каждой таблицы/вью. Только в development.
      </p>

      <div className="space-y-4">
        {Object.entries(schema).map(([table, keys]) => (
          <NeonCard key={table} glow={keys.includes('[error]') ? 'red' : 'none'}>
            <h2 className="font-mono font-semibold text-sm text-neon-cyan mb-2">{table}</h2>
            {keys.length === 0 ? (
              <p className="text-xs text-muted-foreground">Нет данных (пустая таблица)</p>
            ) : keys.includes('[error]') ? (
              <p className="text-xs text-neon-red">Ошибка доступа (таблица не существует или нет прав)</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {keys.map((k) => (
                  <span
                    key={k}
                    className="text-[11px] font-mono bg-secondary rounded px-1.5 py-0.5 text-muted-foreground"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
          </NeonCard>
        ))}
      </div>
    </div>
  )
}
