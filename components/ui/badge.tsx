import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/20 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/20 text-neon-red',
        outline: 'border-border text-foreground',
        green: 'border-neon-green/30 bg-neon-green/10 text-neon-green',
        cyan: 'border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan',
        red: 'border-neon-red/30 bg-neon-red/10 text-neon-red',
        yellow: 'border-neon-yellow/30 bg-neon-yellow/10 text-neon-yellow',
        purple: 'border-neon-purple/30 bg-neon-purple/10 text-neon-purple',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
