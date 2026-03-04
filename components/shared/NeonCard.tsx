import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface NeonCardProps {
  children: ReactNode
  className?: string
  glow?: 'green' | 'cyan' | 'red' | 'yellow' | 'none'
  active?: boolean
  onClick?: () => void
}

const GLOW_MAP = {
  green: 'neon-border-green',
  cyan: 'neon-border-cyan',
  red: 'neon-border-red',
  yellow: 'neon-border-yellow',
  none: '',
}

export function NeonCard({ children, className, glow = 'none', active, onClick }: NeonCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card rounded-xl p-4 border',
        glow !== 'none' && GLOW_MAP[glow],
        active && 'ring-1 ring-neon-cyan/60',
        onClick && 'cursor-pointer',
        'animate-fade-in',
        className
      )}
    >
      {children}
    </div>
  )
}
