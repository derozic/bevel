'use client'

import type { ComponentType, SVGProps } from 'react'
import {
  BellAlertIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LinkIcon,
  MegaphoneIcon,
  QrCodeIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

type IconComp = ComponentType<SVGProps<SVGSVGElement>>

const ICONS: Record<string, IconComp> = {
  'device-phone-mobile': DevicePhoneMobileIcon,
  'device-tablet': DeviceTabletIcon,
  'computer-desktop': ComputerDesktopIcon,
  sparkles: SparklesIcon,
  'shield-check': ShieldCheckIcon,
  'bell-alert': BellAlertIcon,
  megaphone: MegaphoneIcon,
  'rocket-launch': RocketLaunchIcon,
  'cloud-arrow-down': CloudArrowDownIcon,
  'qr-code': QrCodeIcon,
  'information-circle': InformationCircleIcon,
  'exclamation-triangle': ExclamationTriangleIcon,
  'check-circle': CheckCircleIcon,
  link: LinkIcon,
  'user-group': UserGroupIcon,
  'cpu-chip': CpuChipIcon,
  // PascalCase aliases
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  ComputerDesktopIcon,
  SparklesIcon,
  ShieldCheckIcon,
  BellAlertIcon,
  MegaphoneIcon,
  RocketLaunchIcon,
  CloudArrowDownIcon,
  QrCodeIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LinkIcon,
  UserGroupIcon,
  CpuChipIcon,
}

export function resolveAnnouncementIcon(
  id?: string | null,
): IconComp | null {
  if (!id) return null
  const key = id.trim()
  if (!key) return null
  return ICONS[key] ?? ICONS[key.replace(/Icon$/, '')] ?? null
}

export function AnnouncementIcon({
  id,
  className,
}: {
  id?: string | null
  className?: string
}) {
  const Icon = resolveAnnouncementIcon(id)
  if (!Icon) return null
  return <Icon className={className} aria-hidden />
}
