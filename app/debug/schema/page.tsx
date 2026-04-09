import { redirect } from 'next/navigation'
import { getSchemaKeys } from '@/lib/api/queries'
import { NeonCard } from '@/components/shared/NeonCard'

type SchemaMap = Record<string, string[]>

function normaliseSchema(input: unknown): SchemaMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([table, keys]) => [
      table,
      Array.isArray(keys) ? keys.map((k) => String(k)) : [],
    ]),
  )
}

export default async function DebugSchemaPage() {
  if (process.env.NODE_ENV !== 'development') {
    redirect('/')
  }

  const schema = normaliseSchema(await getSchemaKeys())

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-neon-cyan mb-2">Debug: Schema Keys</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Первый ряд каждой таблицы/вью. Только в development.
      </p>

      <div className="space-y-4">
        {Object.entries(schema).map(([table, keys]) => {
          const hasError = keys.includes('[error]')
          return (
            <NeonCard key={table} glow={hasError ? 'red' : 'none'}>
              <h2 className="font-mono font-semibold text-sm text-neon-cyan mb-2">{table}</h2>
              {keys.length === 0 ? (
                <p className="text-xs text-muted-foreground">Нет данных (пустая таблица)</p>
              ) : hasError ? (
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
          )
        })}
      </div>
    </div>
  )
}
