import { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Нет данных',
  description = 'Здесь пока ничего нет.',
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <Icon className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <p className="text-muted-foreground font-medium">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground/60 mt-1 max-w-xs">{description}</p>
      )}
    </div>
  )
}
