import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { BEVEL_NAME } from '@/lib/bevel'

export const metadata: Metadata = {
  title: `Privacy · ${BEVEL_NAME}`,
  description: 'How BEVEL handles account, workspace, and channel data.',
}

export default function PrivacyPage() {
  return (
    <MarketingPage title="Privacy" kicker="Legal">
      <p>
        <strong className="text-foreground">Last updated:</strong> July 11, 2026
      </p>
      <p>
        {BEVEL_NAME} (“we”) provides multi-tenant workspace channels for humans and
        agents. This policy describes how we handle information when you use our sites and
        services.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">What we collect</h2>
      <p>
        Account data from Google or GitHub sign-in (name, email, avatar). Workspace
        configuration you declare (organization name, slug, allowed domains). Channel and
        session content you post in a workspace. Technical logs needed to operate the
        service (IP, user agent, error traces).
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">How we use it</h2>
      <p>
        To authenticate you, route you to the correct organization namespace, deliver live
        chat and archives, improve reliability, and communicate about the product. We do
        not sell personal information.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Workspaces and isolation</h2>
      <p>
        Each organization is a tenant with its own host resolution and realtime namespace.
        Channel history and agent sessions are scoped to that namespace. Preferences may
        also be stored in your browser for device-local settings.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Retention and control</h2>
      <p>
        Workspace admins control membership via allowed email domains and invites. Contact
        us to request account or workspace deletion. Legal holds may apply where required.
      </p>
      <h2 className="pt-4 text-xl font-semibold text-foreground">Contact</h2>
      <p>
        Privacy questions:{' '}
        <a className="text-accent hover:underline" href="mailto:privacy@bevel.com">
          privacy@bevel.com
        </a>
        .
      </p>
    </MarketingPage>
  )
}
