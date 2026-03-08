'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'

const LS_KEY = 'feya_analytics_state'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  errorMsg: string
}

export class AnalyticsErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      errorMsg: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[Analytics ErrorBoundary]', error, info)
  }

  handleReset = () => {
    try {
      localStorage.removeItem(LS_KEY)
    } catch {
      // ignore
    }
    this.setState({ hasError: false, errorMsg: '' })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <h2 className="text-lg font-semibold text-foreground">Ошибка страницы аналитики</h2>
        {this.state.errorMsg && (
          <p className="text-xs font-mono text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2 max-w-lg text-center break-all">
            {this.state.errorMsg}
          </p>
        )}
        <button
          onClick={this.handleReset}
          className="mt-2 px-4 py-2 rounded-lg bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan text-sm hover:bg-neon-cyan/30 transition-colors"
        >
          Сбросить настройки аналитики
        </button>
        <p className="text-xs text-muted-foreground">Локальные настройки будут сброшены до значений по умолчанию</p>
      </div>
    )
  }
}
