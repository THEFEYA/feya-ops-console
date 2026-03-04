import { cn } from '@/lib/utils'

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-2 border-neon-cyan/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-neon-cyan animate-spin" />
      </div>
    </div>
  )
}

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-4 h-4 rounded-full border-2 border-transparent border-t-current animate-spin inline-block',
        className
      )}
    />
  )
}
