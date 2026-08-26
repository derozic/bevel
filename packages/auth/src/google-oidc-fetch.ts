/**
 * Auth.js Google provider fetches OIDC discovery on every sign-in.
 * On this machine IPv6 to accounts.google.com often hangs (~10s) then
 * TypeError: fetch failed → Auth.js error=Configuration.
 *
 * Cache the patched discovery doc, retry, and fall back to static endpoints
 * so a blip cannot block Workspace login.
 */

const DISCOVERY_URL =
  'https://accounts.google.com/.well-known/openid-configuration'

const GOOGLE_OIDC_FALLBACK: Record<string, unknown> = {
  issuer: 'https://accounts.google.com',
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
  revocation_endpoint: 'https://oauth2.googleapis.com/revoke',
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
  scopes_supported: ['openid', 'email', 'profile'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
  claims_supported: ['aud', 'email', 'email_verified', 'exp', 'iat', 'iss', 'sub'],
  code_challenge_methods_supported: ['S256'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  authorization_response_iss_parameter_supported: false,
}

const CACHE_TTL_MS = 60 * 60 * 1000
let cachedDiscovery: { body: string; expiresAt: number } | null = null

export function resetGoogleOidcCache(): void {
  cachedDiscovery = null
}

function discoveryResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function patchDiscovery(json: Record<string, unknown>): string {
  json.authorization_response_iss_parameter_supported = false
  return JSON.stringify(json)
}

async function fetchDiscovery(): Promise<string> {
  const now = Date.now()
  if (cachedDiscovery && cachedDiscovery.expiresAt > now) {
    return cachedDiscovery.body
  }

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(DISCOVERY_URL, {
        signal: AbortSignal.timeout(4000),
        cache: 'no-store',
      })
      if (!res.ok) {
        lastError = new Error(`OIDC discovery HTTP ${res.status}`)
        continue
      }
      const json = (await res.json()) as Record<string, unknown>
      const body = patchDiscovery(json)
      cachedDiscovery = { body, expiresAt: now + CACHE_TTL_MS }
      return body
    } catch (err) {
      lastError = err
    }
  }

  console.warn(
    '[auth] Google OIDC discovery failed; using static endpoints',
    lastError instanceof Error ? lastError.message : lastError,
  )
  const body = JSON.stringify(GOOGLE_OIDC_FALLBACK)
  cachedDiscovery = { body, expiresAt: now + 5 * 60 * 1000 }
  return body
}

export async function googleOidcFetch(
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  const input = args[0]
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url

  if (url.includes('.well-known/openid-configuration')) {
    return discoveryResponse(await fetchDiscovery())
  }

  try {
    return await fetch(...args)
  } catch (err) {
    if (args[1]?.signal?.aborted) throw err
    await new Promise((r) => setTimeout(r, 250))
    return await fetch(...args)
  }
}
