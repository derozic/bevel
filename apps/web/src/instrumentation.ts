/**
 * Prefer IPv4 when resolving external hosts (Google OIDC, etc.).
 * Tailscale/mobile hotspot DNS often returns AAAA first while IPv6 is broken,
 * which makes Auth.js `signIn('google')` fail with TypeError: fetch failed
 * and surfaces as login?error=Configuration.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dns = await import('node:dns')
    dns.setDefaultResultOrder('ipv4first')
    try {
      // Require (not import) so production next typecheck does not need a
      // direct undici dependency. Node 18+ still ships it at runtime.
      const { createRequire } = await import('node:module')
      const { Agent, setGlobalDispatcher } = createRequire(import.meta.url)('undici') as {
        Agent: new (opts: { connect: { family: number } }) => object
        setGlobalDispatcher: (dispatcher: object) => void
      }
      setGlobalDispatcher(
        new Agent({
          connect: { family: 4 },
        }),
      )
    } catch {
      // Node without undici — ipv4first DNS is still set.
    }
  }
}
