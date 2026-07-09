import { z } from 'zod'

export const DomainVerificationSchema = z.object({
  host: z.string().min(1),
  tenantId: z.string().min(1),
  cnameTarget: z.string().default('cname.bevel.com'),
  status: z.enum(['pending', 'verified', 'failed']).default('pending'),
  verifiedAt: z.string().datetime().optional(),
  lastCheckedAt: z.string().datetime().optional(),
  failureReason: z.string().optional(),
})

export const DomainProvisionRequestSchema = z.object({
  tenantId: z.string().min(1),
  subdomain: z.string().regex(/^[a-z0-9-]+$/),
  apexDomain: z.string().min(1),
})

export type DomainVerification = z.infer<typeof DomainVerificationSchema>
export type DomainProvisionRequest = z.infer<typeof DomainProvisionRequestSchema>

/** Customer-facing hostname: bevel.theirdomain.com */
export function formatTenantHostname(subdomain: string, apexDomain: string): string {
  return `${subdomain}.${apexDomain}`
}

export const BEVEL_CNAME_TARGET = 'cname.bevel.com'