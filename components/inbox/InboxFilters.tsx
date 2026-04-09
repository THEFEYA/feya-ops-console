'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, X } from 'lucide-react'

export interface InboxFilters {
  search: string
  source: string
  status: string
  country: string
  scenario: string
  mode: string
}

interface Props {
  filters: InboxFilters
  onChange: (filters: InboxFilters) => void
}

export function InboxFilterBar({ filters, onChange }: Props) {
  function update(key: keyof InboxFilters, value: string) {
    onChange({ ...filters, [key]: value })
  }

  function reset() {
    onChange({ search: '', source: '', status: '', country: '', scenario: '', mode: '' })
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Поиск по объекту, источнику, сценарию…"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="pl-8 h-9 text-xs"
        />
      </div>

      <Input
        placeholder="Сценарий"
        value={filters.scenario}
        onChange={(e) => update('scenario', e.target.value)}
        className="w-36 h-9 text-xs"
      />

      <Select value={filters.mode || 'all'} onValueChange={(v) => update('mode', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-40 h-9 text-xs">
          <SelectValue placeholder="Режим" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все режимы</SelectItem>
          <SelectItem value="Сценарный режим">Сценарный режим</SelectItem>
          <SelectItem value="С поддержкой FEYA">С поддержкой FEYA</SelectItem>
          <SelectItem value="Личный режим">Личный режим</SelectItem>
        </SelectContent>
      </Select>

      <Input
        placeholder="Источник"
        value={filters.source}
        onChange={(e) => update('source', e.target.value)}
        className="w-28 h-9 text-xs"
      />

      <Input
        placeholder="Состояние"
        value={filters.status}
        onChange={(e) => update('status', e.target.value)}
        className="w-32 h-9 text-xs"
      />

      <Input
        placeholder="Гео"
        value={filters.country}
        onChange={(e) => update('country', e.target.value)}
        className="w-24 h-9 text-xs"
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-9 text-xs gap-1 text-muted-foreground">
          <X className="w-3 h-3" /> Сбросить
        </Button>
      )}
    </div>
  )
}
