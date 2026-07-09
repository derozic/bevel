import express from 'express'
import { promises as dns } from 'node:dns'
import {
  BEVEL_CNAME_TARGET,
  DomainVerificationSchema,
} from '@bevel/schema/domain'

const app = express()
const port = Number(process.env.DOMAINS_PORT ?? 43209)
const cnameTarget = process.env.BEVEL_CNAME_TARGET ?? BEVEL_CNAME_TARGET

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'bevel-domains', cnameTarget })
})

app.post('/verify', async (req, res) => {
  const host = String(req.body.host ?? '').toLowerCase()
  const tenantId = String(req.body.tenantId ?? '')

  if (!host || !tenantId) {
    res.status(400).json({ error: 'host and tenantId required' })
    return
  }

  let status: 'pending' | 'verified' | 'failed' = 'pending'
  let failureReason: string | undefined

  try {
    const records = await dns.resolveCname(host)
    const normalizedTarget = cnameTarget.toLowerCase().replace(/\.$/, '')
    const match = records.some(
      (r) => r.toLowerCase().replace(/\.$/, '') === normalizedTarget,
    )
    status = match ? 'verified' : 'pending'
    if (!match) {
      failureReason = `Expected CNAME to ${cnameTarget}, got ${records.join(', ') || 'none'}`
    }
  } catch (err) {
    status = 'pending'
    failureReason =
      err instanceof Error ? err.message : 'DNS lookup failed — record may not exist yet'
  }

  const payload = DomainVerificationSchema.parse({
    host,
    tenantId,
    cnameTarget,
    status,
    lastCheckedAt: new Date().toISOString(),
    failureReason,
    verifiedAt: status === 'verified' ? new Date().toISOString() : undefined,
  })

  res.json(payload)
})

app.listen(port, () => {
  console.log(`BEVEL domains service listening on :${port} (CNAME → ${cnameTarget})`)
})