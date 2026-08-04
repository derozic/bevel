import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalNav } from '@/components/marketing/LegalNav'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Subprocessors · ${BEVEL_NAME}`,
  description: 'Third parties that may process data on behalf of BEVEL.',
}

const UPDATED = 'August 4, 2026'

const ROWS: Array<{
  name: string
  purpose: string
  location: string
}> = [
  {
    name: 'Amazon Web Services (AWS)',
    purpose: 'Infrastructure hosting, compute, storage, networking',
    location: 'United States (and regional edge as configured)',
  },
  {
    name: 'Google Cloud / Google Workspace OAuth',
    purpose: 'Optional authentication identity provider',
    location: 'United States / global',
  },
  {
    name: 'GitHub',
    purpose: 'Optional authentication and work-mode integrations',
    location: 'United States / global',
  },
  {
    name: 'OpenRouter / model providers (as configured)',
    purpose: 'Large language model inference for agent replies',
    location: 'Varies by selected model vendor',
  },
  {
    name: 'Twilio',
    purpose: 'Optional SMS notifications and OTP (when enabled)',
    location: 'United States / global',
  },
  {
    name: 'SendGrid (or equivalent email)',
    purpose: 'Transactional email delivery (when configured)',
    location: 'United States / global',
  },
  {
    name: 'Cloudflare (when used for DNS/CDN/WAF)',
    purpose: 'DNS, edge security, content delivery',
    location: 'Global edge network',
  },
]

export default function SubprocessorsPage() {
  return (
    <MarketingPage title="Subprocessors" kicker="Legal">
      <p>
        <strong className="text-foreground">Last updated:</strong> {UPDATED}
      </p>
      <p>
        {BEVEL_NAME} uses carefully selected third parties (“subprocessors”) to help
        deliver the Services. This list supports transparency under our{' '}
        <Link href="/dpa" className="text-accent hover:underline">
          DPA
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <p>
        Customer-enabled integrations (for example Slack workspaces, BlueBubbles on a
        customer Mac, or customer-owned API keys for Anthropic/OpenAI/xAI) are controlled
        by the customer and are not BEVEL subprocessors for that customer’s own vendor
        relationship.
      </p>

      <div className="not-prose mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/50 text-foreground">
              <th className="px-3 py-2.5 font-semibold">Subprocessor</th>
              <th className="px-3 py-2.5 font-semibold">Purpose</th>
              <th className="px-3 py-2.5 font-semibold">Location</th>
            </tr>
          </thead>
          <tbody className="text-muted">
            {ROWS.map((row) => (
              <tr key={row.name} className="border-b border-border/70 last:border-0">
                <td className="px-3 py-2.5 align-top font-medium text-foreground">
                  {row.name}
                </td>
                <td className="px-3 py-2.5 align-top">{row.purpose}</td>
                <td className="px-3 py-2.5 align-top">{row.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="pt-6 text-xl font-semibold text-foreground">Updates</h2>
      <p>
        We may update this list as our infrastructure evolves. Material additions will be
        reflected here; organization customers may object as described in the DPA by
        emailing{' '}
        <a className="text-accent hover:underline" href="mailto:privacy@bevel.com">
          privacy@bevel.com
        </a>
        .
      </p>

      <LegalNav current="/subprocessors" />
    </MarketingPage>
  )
}
