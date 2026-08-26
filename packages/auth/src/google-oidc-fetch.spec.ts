import { afterEach, describe, expect, it, vi } from 'vitest'
import { googleOidcFetch, resetGoogleOidcCache } from './google-oidc-fetch'

afterEach(() => {
  resetGoogleOidcCache()
  vi.unstubAllGlobals()
})

describe('googleOidcFetch', () => {
  it('patches discovery and caches the body', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          issuer: 'https://accounts.google.com',
          authorization_response_iss_parameter_supported: true,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const first = await googleOidcFetch(
      'https://accounts.google.com/.well-known/openid-configuration',
    )
    const second = await googleOidcFetch(
      'https://accounts.google.com/.well-known/openid-configuration',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const json = (await first.json()) as {
      authorization_response_iss_parameter_supported: boolean
    }
    expect(json.authorization_response_iss_parameter_supported).toBe(false)
    expect(second.status).toBe(200)
  })

  it('falls back to static endpoints when discovery hangs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    const res = await googleOidcFetch(
      'https://accounts.google.com/.well-known/openid-configuration',
    )
    const json = (await res.json()) as {
      authorization_endpoint: string
      authorization_response_iss_parameter_supported: boolean
    }
    expect(json.authorization_endpoint).toContain('accounts.google.com')
    expect(json.authorization_response_iss_parameter_supported).toBe(false)
  })
})
