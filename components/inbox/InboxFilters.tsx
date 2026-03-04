'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, X } from 'lucide-react'

export interface InboxFilters {
  search: string
  warmth: string
  source: string
  country: string
  status: string
  scoreMin: string
  scoreMax: string
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
    onChange({ search: '', warmth: '', source: '', country: '', status: '', scoreMin: '', scoreMax: '' })
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Поиск по заголовку или URL…"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <Select value={filters.warmth || 'all'} onValueChange={(v) => update('warmth', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue placeholder="Интент" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все</SelectItem>
          <SelectItem value="hot">🔴 Горячий</SelectItem>
          <SelectItem value="warm">🟡 Тёплый</SelectItem>
          <SelectItem value="cold">🔵 Холодный</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.status || 'all'} onValueChange={(v) => update('status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все</SelectItem>
          <SelectItem value="open">Открытые</SelectItem>
          <SelectItem value="approved">Одобренные</SelectItem>
          <SelectItem value="shortlisted">Шортлист</SelectItem>
          <SelectItem value="rejected">Отклонённые</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Input
          placeholder="Скор от"
          value={filters.scoreMin}
          onChange={(e) => update('scoreMin', e.target.value)}
          className="w-20 h-8 text-xs"
          type="number"
          min={0}
          max={100}
        />
        <span className="text-muted-foreground text-xs">—</span>
        <Input
          placeholder="до"
          value={filters.scoreMax}
          onChange={(e) => update('scoreMax', e.target.value)}
          className="w-16 h-8 text-xs"
          type="number"
          min={0}
          max={100}
        />
      </div>

      <Input
        placeholder="Источник"
        value={filters.source}
        onChange={(e) => update('source', e.target.value)}
        className="w-28 h-8 text-xs"
      />

      <Input
        placeholder="Страна"
        value={filters.country}
        onChange={(e) => update('country', e.target.value)}
        className="w-24 h-8 text-xs"
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-8 text-xs gap-1 text-muted-foreground">
          <X className="w-3 h-3" /> Сбросить
        </Button>
      )}
    </div>
  )
}
