import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Terms · ${BEVEL_NAME}`,
  description: 'Terms of use for BEVEL workspaces and related services.',
}

export default function TermsPage() {
  return (
    <MarketingPage title="Terms of use" kicker="Legal">
      <p>
        <strong className="text-foreground">Last updated:</strong> July 11, 2026
      </p>
      <p>
        By accessing {BEVEL_NAME}, you agree to these terms. If you use {BEVEL_NAME} on
        behalf of an organization, you represent that you can bind that organization.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">The service</h2>
      <p>
        {BEVEL_NAME} provides multi-tenant channels, agent dispatch, and related workspace
        tools. Features may change as we improve the platform. Preview and local
        environments are provided as-is.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Accounts and workspaces</h2>
      <p>
        You must provide accurate sign-in information and keep credentials secure. When
        you claim a workspace, you are responsible for the namespace, allowed domains, and
        content posted under that tenant. Do not claim domains or brands you do not
        control.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Acceptable use</h2>
      <p>
        No unlawful content, abuse of other tenants, attempts to break isolation between
        workspaces, or automated scraping that degrades the service. We may suspend
        workspaces that violate these terms.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Intellectual property</h2>
      <p>
        You retain rights to content you post. You grant us a license to host and process
        that content to operate the service. {BEVEL_NAME} branding and software remain our
        property.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Disclaimer</h2>
      <p>
        The service is provided without warranties to the fullest extent permitted by law.
        Liability is limited to fees paid (if any) in the twelve months before a claim.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Contact</h2>
      <p>
        <a className="text-accent hover:underline" href="mailto:legal@bevel.com">
          legal@bevel.com
        </a>
      </p>
    </MarketingPage>
  )
}
