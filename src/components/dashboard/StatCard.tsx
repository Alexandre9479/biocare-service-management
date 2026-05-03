import React from 'react'
import { cn } from '@/utils/cn'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  iconBg?: string
  trend?: { value: number; label: string }
  onClick?: () => void
  className?: string
}

export default function StatCard({
  title, value, subtitle, icon, iconBg = 'bg-biocare-purple-500/20',
  trend, onClick, className
}: StatCardProps) {
  return (
    <div
      className={cn(
        'stat-card card-hover',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-slate-50 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-slate-300', iconBg)}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium',
          trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
          <span className="text-slate-500 font-normal">{trend.label}</span>
        </div>
      )}
    </div>
  )
}
