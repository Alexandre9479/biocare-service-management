import type { AvailabilityStatus, Equipment, EquipmentStatus, SaleType } from '@/types'

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatCurrency(amount: number | undefined | null): string {
  if (amount === null || amount === undefined) return 'KES 0.00'
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function getDaysUntilService(nextServiceDate: string | undefined | null): number {
  if (!nextServiceDate) return 999
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(nextServiceDate)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getServiceUrgency(nextServiceDate: string | undefined | null): 'overdue' | 'due_soon' | 'ok' {
  const days = getDaysUntilService(nextServiceDate)
  if (days < 0) return 'overdue'
  if (days <= 7) return 'due_soon'
  return 'ok'
}

export function getSaleTypeLabel(saleType: SaleType): string {
  const map: Record<SaleType, string> = {
    cash: 'Cash Sale',
    placement: 'Placement',
    hire_purchase: 'Hire Purchase',
  }
  return map[saleType] ?? 'Unknown'
}

// Returns Tailwind classes for the sale type badge
export function getSaleTypeClasses(saleType: SaleType): string {
  const map: Record<SaleType, string> = {
    cash: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    placement: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    hire_purchase: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  }
  return map[saleType] ?? 'bg-slate-500/20 text-slate-400'
}

export function getSaleTypeDotColor(saleType: SaleType): string {
  const map: Record<SaleType, string> = {
    cash: 'bg-emerald-400',
    placement: 'bg-orange-400',
    hire_purchase: 'bg-blue-400',
  }
  return map[saleType] ?? 'bg-slate-400'
}

export function getStatusClasses(status: EquipmentStatus): string {
  const map: Record<EquipmentStatus, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    inactive: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    decommissioned: 'bg-red-500/20 text-red-400 border border-red-500/30',
  }
  return map[status] ?? 'bg-slate-500/20 text-slate-400'
}

export function getAvailabilityClasses(status: AvailabilityStatus): string {
  const map: Record<AvailabilityStatus, string> = {
    available: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    on_service: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    on_leave: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    unavailable: 'bg-red-500/20 text-red-400 border border-red-500/30',
  }
  return map[status] ?? 'bg-slate-500/20 text-slate-400'
}

export function getAvailabilityLabel(status: AvailabilityStatus): string {
  const map: Record<AvailabilityStatus, string> = {
    available: 'Available',
    on_service: 'On Service Call',
    on_leave: 'On Leave',
    unavailable: 'Unavailable',
  }
  return map[status] ?? status
}

export function calculateHPProgress(equipment: Equipment): number {
  if (
    equipment.sale_type !== 'hire_purchase' ||
    !equipment.hp_total_installments ||
    equipment.hp_total_installments === 0
  ) return 0
  const paid = equipment.hp_installments_paid ?? 0
  return Math.min(100, Math.round((paid / equipment.hp_total_installments) * 100))
}

export function truncate(str: string, n: number): string {
  return str.length <= n ? str : str.slice(0, n - 1) + '…'
}

export function getServiceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    preventive: 'Preventive Maintenance',
    corrective: 'Corrective Maintenance',
    installation: 'Installation',
    calibration: 'Calibration',
    emergency: 'Emergency',
  }
  return map[type] ?? type
}

export function getPriorityClasses(priority: string): string {
  const map: Record<string, string> = {
    low: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    medium: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    high: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    urgent: 'bg-red-500/20 text-red-400 border border-red-500/30',
  }
  return map[priority] ?? 'bg-slate-500/20 text-slate-400'
}
