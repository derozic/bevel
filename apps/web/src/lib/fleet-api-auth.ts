import { mintApiToken } from '@bevel/auth/tokens'
import type { Session } from 'next-auth'

export async function resolveFleetApiToken(
  session: Session | null | undefined,
): Promise<string | null> {
  if (!session?.user?.email) return null
  const extended = session as Session & { apiToken?: string; tenantId?: string }
  if (extended.apiToken) return extended.apiToken

  const email = session.user.email
  const userId = session.user.id ?? email
  const role = (session.user as { role?: string }).role ?? 'member'

  try {
    return await mintApiToken({
      email,
      user_id: userId,
      role,
      tenantId: extended.tenantId,
    })
  } catch {
    return null
  }
}