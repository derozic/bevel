import type { Session } from 'next-auth'

/**
 * Stable actor key for a signed-in user.
 * Auth.js session callbacks may populate email without `user.id`
 * (partial JWT / custom session()). Talk used to require id and bounce
 * to login; login saw email and bounced back — epileptic full-page swap.
 */
export function sessionActorId(session: Session | null | undefined): string | null {
  const id = session?.user?.id?.trim()
  if (id) return id
  const email = session?.user?.email?.trim()
  if (email) return email
  return null
}

export function sessionHasEmail(
  session: Session | null | undefined,
): boolean {
  return Boolean(session?.user?.email?.trim())
}
