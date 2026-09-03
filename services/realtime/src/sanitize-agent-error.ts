/**
 * Human-safe agent failure copy for fleet channel bubbles.
 * Never surface stack traces, Bearer tokens, or raw Axios dumps.
 */
import { agentStumbled, fleetRateLimited } from './system-voice.js'

export type SanitizedAgentError = {
  publicMessage: string
  code:
    | 'rate_limit'
    | 'auth'
    | 'forbidden'
    | 'model'
    | 'module'
    | 'unknown_agent'
    | 'network'
    | 'generic'
  detail: string
}

function redact(raw: string): string {
  return raw
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/sk-or-v1-[a-zA-Z0-9]+/g, '[redacted-openrouter-key]')
    .replace(/sk-[a-zA-Z0-9_-]{10,}/g, '[redacted-key]')
    .replace(/Authorization:\s*[^\n]+/gi, 'Authorization: [redacted]')
    .replace(/api[_-]?key[=:]\s*\S+/gi, 'api_key=[redacted]')
    .slice(0, 400)
}

export function sanitizeAgentError(
  agentName: string,
  reason: unknown,
): SanitizedAgentError {
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Agent failed'
  const detail = redact(msg)
  const lower = detail.toLowerCase()

  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    (reason instanceof Error && reason.name === 'OpenRouterRateLimitError')
  ) {
    return {
      publicMessage: fleetRateLimited(agentName),
      code: 'rate_limit',
      detail,
    }
  }
  if (
    lower.includes('no credits remaining') ||
    lower.includes('insufficient_quota') ||
    lower.includes('key limit exceeded') ||
    lower.includes('status code 403') ||
    lower.includes('error code 403')
  ) {
    return {
      publicMessage: `${agentName} cannot reach the model provider (credits or key limit). An operator needs to check OpenRouter and the native provider keys on realtime.`,
      code: 'forbidden',
      detail,
    }
  }
  if (
    lower.includes('status code 401') ||
    lower.includes('unauthorized') ||
    lower.includes('openrouter_api_key') ||
    (lower.includes('bearer') && lower.includes('empty'))
  ) {
    return {
      publicMessage: `${agentName} cannot reach the model provider (auth). An operator needs to check OPENROUTER_API_KEY on realtime.`,
      code: 'auth',
      detail,
    }
  }
  if (
    lower.includes('is not a valid model') ||
    lower.includes('no endpoints found for') ||
    lower.includes('status code 400') ||
    lower.includes('status code 404')
  ) {
    return {
      publicMessage: `${agentName} hit a model routing error. The fleet model ids may need updating.`,
      code: 'model',
      detail,
    }
  }
  if (
    lower.includes('cannot find module') ||
    lower.includes('module_not_found') ||
    lower.includes('runner.js')
  ) {
    return {
      publicMessage: `${agentName} could not load the fleet runner. Check AGENTS_REPO_ROOT and the agents install on the host.`,
      code: 'module',
      detail,
    }
  }
  if (lower.includes('unknown agent')) {
    return {
      publicMessage: `${agentName} is not registered in the fleet runner. Available agents may differ from the channel roster.`,
      code: 'unknown_agent',
      detail,
    }
  }
  if (
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('network')
  ) {
    return {
      publicMessage: `${agentName} could not reach the model provider (network). Try again in a moment.`,
      code: 'network',
      detail,
    }
  }
  return {
    publicMessage: agentStumbled(agentName),
    code: 'generic',
    detail,
  }
}

/** True when a fulfilled agent reply is actually a leaked stack / provider dump. */
export function isLeakedAgentFailure(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('cannot find module') ||
    lower.includes('require stack') ||
    lower.includes('axioserror') ||
    lower.includes('status code 403') ||
    lower.includes('status code 401') ||
    lower.includes('key limit exceeded') ||
    lower.includes('no credits remaining')
  )
}

/** Channel bubble text: keep real replies, rewrite leaked internals. */
export function publicAgentBubble(agentName: string, text: string): string {
  if (!text || !isLeakedAgentFailure(text)) return text
  return sanitizeAgentError(agentName, text).publicMessage
}
