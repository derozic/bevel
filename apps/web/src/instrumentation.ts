/**
 * Prefer IPv4 when resolving external hosts (Google OIDC, etc.).
 * Tailscale/mobile hotspot DNS often returns AAAA first while IPv6 is broken,
 * which makes Auth.js `signIn('google')` fail with TypeError: fetch failed.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dns = await import('node:dns')
    dns.setDefaultResultOrder('ipv4first')
  }
}
