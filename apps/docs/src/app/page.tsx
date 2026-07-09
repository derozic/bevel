export default function DocsHome() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1>BEVEL</h1>
      <p>Platform for multi-tenant workspace channels — declarative tenants, isolated transports.</p>

      <h2>Transport layers</h2>
      <ol>
        <li>
          <strong>Async stream</strong> — SSE via <code>@bevel/async-stream</code> (AI deltas,
          progress, notifications)
        </li>
        <li>
          <strong>Live bidirectional</strong> — WebSocket via <code>services/realtime</code> +
          <code>@bevel/realtime-client</code> (chat, presence)
        </li>
        <li>
          <strong>Live media</strong> — WebRTC via <code>@bevel/feature-webrtc</code> (opt-in
          only)
        </li>
      </ol>

      <h2>Declarative tenant</h2>
      <pre style={{ background: '#111', color: '#eee', padding: '1rem', borderRadius: 8 }}>
{`tenant: acme
domain: bevel.acme.com
brand:
  logo: ./logo.svg
  theme: ./theme.json
features:
  async_streams: true
  live_sessions: true
realtime:
  namespace: acme
  presence: true`}
      </pre>

      <h2>Control plane</h2>
      <pre style={{ background: '#111', color: '#eee', padding: '1rem', borderRadius: 8 }}>
{`pnpm bevel doctor acme
pnpm bevel validate acme
pnpm bevel list`}
      </pre>

      <h2>Runtime API</h2>
      <pre style={{ background: '#111', color: '#eee', padding: '1rem', borderRadius: 8 }}>
{`import { getTenantFromRequest } from '@bevel/tenant-config'

const tenant = await getTenantFromRequest()`}
      </pre>
    </main>
  )
}