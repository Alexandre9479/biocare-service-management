import React from 'react'
import { cn } from '@/utils/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-3', lg: 'w-12 h-12 border-4' }

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div className={cn(
      'rounded-full border-biocare-purple-500 border-t-transparent animate-spin',
      sizes[size],
      className
    )} />
  )
}

export function PageSpinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="lg" />
      <p className="text-slate-500 text-sm">Loading...</p>
    </div>
  )
}
