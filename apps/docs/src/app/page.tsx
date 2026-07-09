export default function DocsHome() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1>BEVEL</h1>
      <p>Open channels for humans and agents — multi-tenant by hostname.</p>

      <h2>Tenant resolution</h2>
      <pre style={{ background: '#111', color: '#eee', padding: '1rem', borderRadius: 8 }}>
{`import { getTenantFromRequest } from '@bevel/tenant-config'

export default async function Page() {
  const tenant = await getTenantFromRequest()
  // tenant.theme, tenant.auth, tenant.realtime.namespace, …
}`}
      </pre>

      <h2>Custom domain</h2>
      <p>
        Customers add <code>bevel.theirdomain.com CNAME cname.bevel.com</code>. The platform
        resolves the tenant from the <code>Host</code> header at the edge.
      </p>

      <h2>Monorepo layout</h2>
      <ul>
        <li><code>apps/web</code> — tenant Next.js app</li>
        <li><code>apps/admin</code> — operator console</li>
        <li><code>services/realtime</code> — Colyseus transport</li>
        <li><code>services/domains</code> — DNS verification</li>
        <li><code>packages/tenant-config</code> — schema + loader</li>
      </ul>
    </main>
  )
}