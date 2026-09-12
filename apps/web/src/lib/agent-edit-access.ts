import type { Session } from 'next-auth'
import { listMembershipsForEmail } from '@bevel/tenant-config'

/** Workspace admins / owners, or GitHub work-mode writers, may edit SOUL/SKILL. */
export function canEditAgentFiles(
  session: Session | null | undefined,
): boolean {
  if (!session?.user) return false
  if (session.canPutOnWork) return true
  const email = session.user.email?.trim()
  if (!email) return false
  return listMembershipsForEmail(email).some(
    (m) => m.role === 'admin' || m.role === 'owner',
  )
}
