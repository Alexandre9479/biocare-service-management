import React from 'react'
import { cn } from '@/utils/cn'

interface BadgeProps {
  children: React.ReactNode
  className?: string
  dot?: boolean
  dotColor?: string
}

export default function Badge({ children, className, dot, dotColor }: BadgeProps) {
  return (
    <span className={cn('badge', className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColor ?? 'bg-current')} />}
      {children}
    </span>
  )
}
