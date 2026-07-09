'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Copy, Globe, Loader2 } from 'lucide-react'
import {
  BEVEL_CNAME_TARGET,
  formatTenantHostname,
} from '@bevel/schema/domain'
import { Button, cn } from '@bevel/ui'

const TENANTS = [
  { slug: 'demo', name: 'BEVEL Demo', apexExample: 'derozic.com' },
  { slug: 'acme', name: 'Acme Corp', apexExample: 'acme.com' },
]

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--bevel-text-muted)]">
        {label}
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--bevel-border)] bg-black/20 px-3 py-2 font-mono text-sm">
        <span className="flex-1 truncate">{value}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded p-1 text-[var(--bevel-text-muted)] hover:bg-white/5 hover:text-[var(--bevel-text)]"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function DomainsPage() {
  const searchParams = useSearchParams()
  const initialSlug = searchParams.get('tenant') ?? 'demo'
  const [tenantSlug, setTenantSlug] = useState(initialSlug)
  const [subdomain, setSubdomain] = useState('bevel')
  const [apexDomain, setApexDomain] = useState('theirdomain.com')
  const [verifying, setVerifying] = useState(false)
  const [status, setStatus] = useState<'idle' | 'pending' | 'verified' | 'failed'>('idle')

  const tenant = useMemo(
    () => TENANTS.find((t) => t.slug === tenantSlug) ?? TENANTS[0]!,
    [tenantSlug],
  )

  const customerHost = formatTenantHostname(subdomain, apexDomain)

  async function verifyDomain() {
    setVerifying(true)
    setStatus('pending')
    try {
      const res = await fetch('/api/domains/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: `tenant_${tenant.slug}`,
          host: customerHost,
        }),
      })
      const data = (await res.json()) as { status?: string }
      setStatus(data.status === 'verified' ? 'verified' : 'pending')
    } catch {
      setStatus('failed')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <div className="flex items-center gap-2 text-[var(--bevel-accent)]">
          <Globe className="h-5 w-5" />
          <h1 className="text-2xl font-semibold">Custom domain</h1>
        </div>
        <p className="mt-2 text-sm text-[var(--bevel-text-muted)]">
          Point your hostname at BEVEL. We resolve tenant config, auth policy, theme, and
          realtime namespace from the{' '}
          <code className="rounded bg-black/30 px-1 font-mono text-xs">Host</code> header.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-6">
        <label className="block space-y-2">
          <span className="text-sm font-medium">Tenant</span>
          <select
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            className="w-full rounded-lg border border-[var(--bevel-border)] bg-black/20 px-3 py-2 text-sm"
          >
            {TENANTS.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Subdomain</span>
            <input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="bevel"
              className="w-full rounded-lg border border-[var(--bevel-border)] bg-black/20 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Apex domain</span>
            <input
              value={apexDomain}
              onChange={(e) => setApexDomain(e.target.value)}
              placeholder={tenant.apexExample}
              className="w-full rounded-lg border border-[var(--bevel-border)] bg-black/20 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-6">
        <h2 className="text-lg font-medium">DNS instructions</h2>
        <p className="text-sm text-[var(--bevel-text-muted)]">
          Add a CNAME record so traffic for your workspace resolves through BEVEL:
        </p>

        <CopyField label="Hostname (Name)" value={customerHost} />
        <CopyField label="Record type" value="CNAME" />
        <CopyField label="Target" value={BEVEL_CNAME_TARGET} />

        <div className="rounded-lg border border-dashed border-[var(--bevel-border)] bg-black/10 p-4 text-sm text-[var(--bevel-text-muted)]">
          <p className="font-mono text-[var(--bevel-text)]">
            {customerHost} CNAME {BEVEL_CNAME_TARGET}
          </p>
          <p className="mt-2">
            Request flow:{' '}
            <span className="text-[var(--bevel-text)]">Host: {customerHost}</span> → tenant
            lookup → theme/config/features → auth policy → realtime namespace → tenant app
          </p>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Button onClick={verifyDomain} disabled={verifying}>
          {verifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking DNS…
            </>
          ) : (
            'Verify domain'
          )}
        </Button>
        <span
          className={cn(
            'text-sm',
            status === 'verified' && 'text-green-500',
            status === 'pending' && 'text-amber-400',
            status === 'failed' && 'text-red-400',
            status === 'idle' && 'text-[var(--bevel-text-muted)]',
          )}
        >
          {status === 'idle' && 'Not verified yet'}
          {status === 'pending' && 'Pending — DNS propagation may take up to 48h'}
          {status === 'verified' && 'Verified'}
          {status === 'failed' && 'Verification failed'}
        </span>
      </section>
    </div>
  )
}