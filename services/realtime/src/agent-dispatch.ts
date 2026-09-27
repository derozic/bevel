import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { config } from './config.js'
import { resolveWorkspaceForRepo } from './work-repos.js'
import {
  dispatchFleetNativeFallback,
  dispatchPlatformAgentChat,
  isPlatformAgent,
} from './platform-providers.js'
import { isLeakedAgentFailure } from './sanitize-agent-error.js'

const require = createRequire(import.meta.url)

type FleetRunner = {
  runAgentChat?: (
    name: string,
    message: string,
    history?: { role: string; content: string }[],
    runOpts?: {
      metadata?: Record<string, unknown>
      mode?: string
    },
  ) => Promise<{ output: string; model: string; confidence: number }>
  runAgentWork?: (
    name: string,
    message: string,
    history?: { role: string; content: string }[],
    opts?: { workspaceRoot?: string; workRepo?: string },
  ) => Promise<{ output: string; model: string; confidence: number }>
}

function runnerCandidates(): string[] {
  const root = config.repoRoot
  return [
    join(root, 'dist', 'runner.js'),
    join(root, 'agents', 'dist', 'runner.js'),
  ].filter((path, i, all) => all.indexOf(path) === i)
}

function loadFleetRunner(): FleetRunner {
  let lastErr: unknown
  for (const runnerPath of runnerCandidates()) {
    if (!existsSync(runnerPath)) continue
    try {
      return require(runnerPath) as FleetRunner
    } catch (err) {
      lastErr = err
    }
  }
  const tried = runnerCandidates().join(', ')
  if (lastErr instanceof Error) {
    lastErr.message = `${lastErr.message} (tried ${tried})`
    throw lastErr
  }
  throw new Error(`Fleet runner not found (tried ${tried})`)
}

export type DispatchChatOpts = {
  /** Solo personal-agent session (e.g. /talk/hermes). */
  personalAgent?: boolean
  /** Multi-agent fleet channel slug when applicable. */
  channelSlug?: string
  /** Tenant slug when known. */
  tenant?: string
}

export async function dispatchAgentChat(
  agentId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  opts: DispatchChatOpts = {},
): Promise<{ output: string; model?: string; confidence?: number }> {
  if (isPlatformAgent(agentId)) {
    return dispatchPlatformAgentChat(agentId, message, history)
  }
  const { runAgentChat } = loadFleetRunner()
  if (typeof runAgentChat !== 'function') {
    throw new Error('Fleet runner is missing runAgentChat')
  }
  const run = () =>
    runAgentChat(agentId, message, history, {
      metadata: {
        personalAgent: opts.personalAgent === true,
        solo: opts.personalAgent === true,
        role: opts.personalAgent ? 'personal' : 'fleet',
        channelSlug: opts.channelSlug,
        tenant: opts.tenant,
        fleet: opts.personalAgent !== true,
      },
    })

  try {
    const res = await run()
    if (!looksLikeProviderFailure(res.output, res.confidence)) return res
    console.warn('[dispatch] OpenRouter path failed in-band; cascading to native LLM', {
      agentId,
    })
    return await dispatchFleetNativeFallback(agentId, message, history)
  } catch (err) {
    try {
      console.warn('[dispatch] OpenRouter unavailable; cascading to native LLM', {
        agentId,
      })
      return await dispatchFleetNativeFallback(agentId, message, history)
    } catch {
      throw err
    }
  }
}

function looksLikeProviderFailure(output?: string, confidence?: number): boolean {
  const text = output || ''
  if (isLeakedAgentFailure(text)) return true
  if (
    /cannot reach the model provider|openrouter_api_key|not configured on this host|unauthorized|status code 401|status code 403/i.test(
      text,
    )
  ) {
    return true
  }
  return confidence === 0 && /not configured|cannot reach|missing/i.test(text)
}

export async function dispatchAgentWork(
  agentId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  workRepo = config.workRepo
): Promise<{ output: string; model?: string; confidence?: number }> {
  if (isPlatformAgent(agentId)) {
    return dispatchPlatformAgentChat(
      agentId,
      `Work mode is on (${workRepo}), but ${agentId} cannot write the repo. Advise only.\n\n${message}`,
      history,
    )
  }
  const { runAgentWork } = loadFleetRunner()
  if (typeof runAgentWork !== 'function') {
    throw new Error('Fleet runner is missing runAgentWork')
  }
  try {
    return await runAgentWork(agentId, message, history, {
      workspaceRoot: resolveWorkspaceForRepo(workRepo),
      workRepo,
    })
  } catch (err) {
    try {
      return await dispatchFleetNativeFallback(agentId, message, history)
    } catch {
      throw err
    }
  }
}