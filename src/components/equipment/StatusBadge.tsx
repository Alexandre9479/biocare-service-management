import React from 'react'
import type { EquipmentStatus } from '@/types'
import { getStatusClasses } from '@/utils/helpers'
import Badge from '@/components/ui/Badge'

const labels: Record<EquipmentStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  decommissioned: 'Decommissioned',
}

const dots: Record<EquipmentStatus, string> = {
  active: 'bg-emerald-400',
  inactive: 'bg-yellow-400',
  decommissioned: 'bg-red-400',
}

export default function StatusBadge({ status }: { status: EquipmentStatus }) {
  return (
    <Badge className={getStatusClasses(status)} dot dotColor={dots[status]}>
      {labels[status]}
    </Badge>
  )
}
