import React from 'react'
import type { SaleType } from '@/types'
import { getSaleTypeClasses, getSaleTypeDotColor, getSaleTypeLabel } from '@/utils/helpers'
import Badge from '@/components/ui/Badge'

interface SaleTypeBadgeProps {
  saleType: SaleType
  size?: 'sm' | 'md'
}

export default function SaleTypeBadge({ saleType, size = 'md' }: SaleTypeBadgeProps) {
  return (
    <Badge
      className={getSaleTypeClasses(saleType)}
      dot
      dotColor={getSaleTypeDotColor(saleType)}
    >
      {getSaleTypeLabel(saleType)}
    </Badge>
  )
}
