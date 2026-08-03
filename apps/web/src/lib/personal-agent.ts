import { getAgentById, agents } from '@/lib/agent-catalog'
import {
  BEVEL_DEFAULT_PERSONAL_AGENT,
  bevelTalkPath,
} from '@/lib/bevel'

/** Resolve the user's primary personal agent (catalog id). */
export function resolvePersonalAgentId(
  preferred?: string | null,
): string {
  const raw = (preferred || '').trim().toLowerCase()
  if (raw && getAgentById(raw)) return raw
  if (getAgentById(BEVEL_DEFAULT_PERSONAL_AGENT)) {
    return BEVEL_DEFAULT_PERSONAL_AGENT
  }
  return agents[0]?.id ?? 'brain'
}

/** Canonical private home → open primary agent thread. */
export function personalAgentTalkPath(preferred?: string | null): string {
  return bevelTalkPath(resolvePersonalAgentId(preferred))
}
