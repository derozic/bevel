import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import {
  isAppleAuthConfigured,
  isGoogleAuthConfigured,
  isMicrosoftAuthConfigured,
} from '@bevel/auth'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'
import { csrfTokenFromCookies } from '@/lib/csrf-cookie'
import { previewConversationLink, redeemConversationLink } from '@/lib/conversation-link'
import { pinWasEntered } from '@/lib/join-pass'
import { sessionActorId } from '@/lib/session-user'
import { JoinLaunch } from './JoinLaunch'

function emailOnWorkspace(email: string | null | undefined, domains: string[]): boolean {
  if (!domains.length) return true
  const host = email?.split('@')[1]?.trim().toLowerCase()
  if (!host) return false
  return domains.some((domain) => {
    const d = domain.toLowerCase()
    return host === d || host.endsWith(`.${d}`)
  })
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const preview = await previewConversationLink(token)
  const session = await auth()
  const signedIn = Boolean(sessionActorId(session))
  const tenant = await getTenantFromRequest()
  const emailDomains = tenant?.auth.allowedEmailDomains ?? []
  const org = tenant?.theme.productName || tenant?.name || 'this workspace'
  const inside = emailOnWorkspace(session?.user?.email, emailDomains)
  const outsideBlocked = preview.status === 'active' && !preview.allowOutside && signedIn && !inside
  const pinOk = await pinWasEntered(token)
  const needsBoth = preview.verify === 'double' && preview.pinRequired
  const canEnter =
    signedIn &&
    preview.status === 'active' &&
    !outsideBlocked &&
    (!needsBoth || pinOk)

  if (canEnter) {
    const href = await redeemConversationLink(token)
    if (href) redirect(href)
  }

  const cookieJar = await cookies()
  const csrfToken = csrfTokenFromCookies((name) => cookieJar.get(name)?.value)
  const callbackUrl = `/join/${encodeURIComponent(token)}`

  return (
    <JoinLaunch
      token={token}
      preview={preview}
      signedIn={signedIn}
      callbackUrl={callbackUrl}
      csrfToken={csrfToken}
      googleOk={isGoogleAuthConfigured()}
      appleOk={isAppleAuthConfigured()}
      microsoftOk={isMicrosoftAuthConfigured()}
      otpOk
      pinAccepted={pinOk}
      outsideBlocked={outsideBlocked}
      org={org}
    />
  )
}
