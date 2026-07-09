import { listTenants } from '@bevel/tenant-config'

export default function TenantsPage() {
  const tenants = listTenants()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <p className="mt-1 text-sm text-[var(--bevel-text-muted)]">
          Registry seed — production loads from domains service / KV.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--bevel-border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--bevel-surface)] text-[var(--bevel-text-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Host</th>
              <th className="px-4 py-3 font-medium">Namespace</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--bevel-border)]">
            {tenants.map((t) => (
              <tr key={t.id} className="bg-[var(--bevel-surface)]/50">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.host}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.realtime.namespace}</td>
                <td className="px-4 py-3 capitalize">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}