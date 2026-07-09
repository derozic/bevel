import { DomainVerificationSchema } from '@bevel/schema/domain'

const DOMAINS_SERVICE =
  process.env.DOMAINS_SERVICE_URL ?? 'http://127.0.0.1:43209'

export async function POST(request: Request) {
  const body = await request.json()
  const host = String(body.host ?? '')
  const tenantId = String(body.tenantId ?? '')

  if (!host || !tenantId) {
    return Response.json({ error: 'host and tenantId required' }, { status: 400 })
  }

  try {
    const res = await fetch(`${DOMAINS_SERVICE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, tenantId }),
    })
    const data = await res.json()
    return Response.json(DomainVerificationSchema.parse(data))
  } catch {
    return Response.json(
      DomainVerificationSchema.parse({
        host,
        tenantId,
        status: 'pending',
      }),
    )
  }
}