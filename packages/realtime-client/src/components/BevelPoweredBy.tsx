'use client'

import { BEVEL_POWERED_BY_LABEL } from '../product/bevel'
import { useFleetOptional } from '../FleetProvider'
import { cn } from '../lib/utils'

export function BevelPoweredBy({
  className,
  label,
}: {
  className?: string
  /** Override when used outside FleetProvider */
  label?: string
}) {
  const fleet = useFleetOptional()
  if (fleet?.showPoweredBy === false) return null

  const text = label ?? fleet?.poweredByLabel ?? BEVEL_POWERED_BY_LABEL

  return (
    <p
      className={cn(
        'text-[10px] font-medium uppercase tracking-[0.22em] text-ink-500',
        className
      )}
      aria-label={text}
    >
      {text}
    </p>
  )
}