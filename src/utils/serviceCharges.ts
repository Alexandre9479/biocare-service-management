import type { Equipment } from '@/types'

export interface ServiceChargeResult {
  serviceCharge: number
  partsCharge: number
  totalCharge: number
  chargeStatus: string
  isChargeable: boolean
  chargeLabel: string
  badgeColor: string
}

export function calculateServiceCharge(
  equipment: Equipment,
  standardServiceFee: number,
  partsTotal: number
): ServiceChargeResult {
  const free = (status: string): ServiceChargeResult => ({
    serviceCharge: 0,
    partsCharge: 0,
    totalCharge: 0,
    chargeStatus: status,
    isChargeable: false,
    chargeLabel: 'FREE',
    badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30',
  })

  const chargeable = (status: string): ServiceChargeResult => {
    const total = standardServiceFee + partsTotal
    return {
      serviceCharge: standardServiceFee,
      partsCharge: partsTotal,
      totalCharge: total,
      chargeStatus: status,
      isChargeable: true,
      chargeLabel: `KES ${total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`,
      badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    }
  }

  switch (equipment.sale_type) {
    case 'cash':
      return chargeable('CHARGEABLE (Cash Sale)')
    case 'placement':
      return free('FREE SERVICE (Placement Contract)')
    case 'hire_purchase':
      if (equipment.hp_payment_status === 'completed') {
        return chargeable('CHARGEABLE (HP Completed)')
      }
      if (equipment.hp_payment_status === 'defaulted') {
        return chargeable('CHARGEABLE (HP Defaulted)')
      }
      return free('FREE SERVICE (Under Hire Purchase)')
    default:
      return chargeable('CHARGEABLE')
  }
}
