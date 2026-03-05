'use client'

import { useState } from 'react'
import { Save, ChevronDown, Star, Trash2 } from 'lucide-react'
import { useAnalytics } from '@/lib/analytics/context'
import { syncPresetToSupabase } from '@/lib/analytics/persist'

export function PresetBar() {
  const { state, dispatch } = useAnalytics()
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  async function handleSave() {
    const name = saveName.trim()
    if (!name) return
    dispatch({ type: 'SAVE_PRESET', payload: { name } })
    setSaveName('')
    setSaving(false)
    // best-effort sync
    const id = `preset_${Date.now()}`
    const { presets, ...rest } = state
    await syncPresetToSupabase(id, name, rest).catch(() => {})
  }

  const activePreset = state.presets.find((p) => p.id === state.activePreset)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Save flow */}
      {saving ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaving(false) }}
            placeholder="Название вида..."
            className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground w-40"
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim()}
            className="px-2 py-1 rounded bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan text-xs disabled:opacity-40 hover:bg-neon-cyan/30 transition-colors"
          >
            Сохранить
          </button>
          <button
            onClick={() => setSaving(false)}
            className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground"
          >
            Отмена
          </button>
        </div>
      ) : (
        <button
          onClick={() => setSaving(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
        >
          <Save size={12} />
          Сохранить вид
        </button>
      )}

      {/* Load presets dropdown */}
      {state.presets.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
          >
            {activePreset ? (
              <span className="text-foreground">{activePreset.name}</span>
            ) : (
              'Загрузить вид'
            )}
            <ChevronDown size={12} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg min-w-48 py-1">
              {state.presets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1 px-2 py-1 hover:bg-secondary/50 group">
                  <button
                    className="flex-1 text-left text-xs text-foreground flex items-center gap-1.5"
                    onClick={() => {
                      dispatch({ type: 'LOAD_PRESET', payload: { id: preset.id } })
                      setDropdownOpen(false)
                    }}
                  >
                    {preset.isDefault && <Star size={10} className="text-yellow-400 fill-yellow-400 shrink-0" />}
                    {preset.name}
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'SET_DEFAULT_PRESET', payload: { id: preset.id } })}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-yellow-400 transition-all"
                    title="Сделать по умолчанию"
                  >
                    <Star size={10} />
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'DELETE_PRESET', payload: { id: preset.id } })}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-red-400 transition-all"
                    title="Удалить"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
