/**
 * Cross-host session handoff (platform entry → org host on another eTLD+1).
 * Codes are issued/redeemed via FastAPI Postgres — not file or memory.
 */

function apiBase(): string {
  return (
    process.env.BEVEL_API_URL ||
    process.env.NEXT_PUBLIC_BEVEL_API_URL ||
    'http://127.0.0.1:43203'
  ).replace(/\/$/, '')
}

function internalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = process.env.FLEET_INTERNAL_API_KEY
  if (key) headers['X-Fleet-Internal-Key'] = key
  return headers
}

export type IssueHandoffInput = {
  email: string
  name?: string | null
  imageUrl?: string | null
  tenantSlug: string
  callbackPath?: string
}

export async function issueAuthHandoffCode(
  input: IssueHandoffInput,
): Promise<{ code: string; expiresAt: string } | null> {
  try {
    const res = await fetch(`${apiBase()}/api/v1/auth/handoff`, {
      method: 'POST',
      headers: internalHeaders(),
      body: JSON.stringify({
        email: input.email,
        name: input.name || '',
        imageUrl: input.imageUrl || null,
        tenantSlug: input.tenantSlug,
        callbackPath: input.callbackPath || '/^general',
      }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      code?: string
      expiresAt?: string
    }
    if (!data.code) return null
    return { code: data.code, expiresAt: data.expiresAt || '' }
  } catch {
    return null
  }
}
