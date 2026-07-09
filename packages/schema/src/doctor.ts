import { z } from 'zod'

export const DoctorCheckStatusSchema = z.enum([
  'pass',
  'fail',
  'warn',
  'skip',
])

export const DoctorCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: DoctorCheckStatusSchema,
  detail: z.string().optional(),
})

export const DoctorReportSchema = z.object({
  tenant: z.string(),
  checkedAt: z.string().datetime(),
  passed: z.boolean(),
  checks: z.array(DoctorCheckSchema),
})

export type DoctorCheckStatus = z.infer<typeof DoctorCheckStatusSchema>
export type DoctorCheck = z.infer<typeof DoctorCheckSchema>
export type DoctorReport = z.infer<typeof DoctorReportSchema>

export const DOCTOR_CHECK_IDS = [
  'tenant-config',
  'domain-cname',
  'ssl-active',
  'theme-tokens',
  'realtime-namespace',
  'auth-policy',
  'preview-deployment',
] as const

export type DoctorCheckId = (typeof DOCTOR_CHECK_IDS)[number]