import { createRequire } from 'node:module'
import { join } from 'node:path'
import { config } from './config.js'
import { resolveWorkspaceForRepo } from './work-repos.js'
import {
  dispatchPlatformAgentChat,
  isPlatformAgent,
} from './platform-providers.js'

const require = createRequire(import.meta.url)

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
  const runnerPath = join(config.repoRoot, 'dist', 'runner.js')
  const { runAgentChat } = require(runnerPath) as {
    runAgentChat: (
      name: string,
      message: string,
      history?: { role: string; content: string }[],
      runOpts?: {
        metadata?: Record<string, unknown>
        mode?: string
      },
    ) => Promise<{ output: string; model: string; confidence: number }>
  }
  const res = await runAgentChat(agentId, message, history, {
    metadata: {
      personalAgent: opts.personalAgent === true,
      solo: opts.personalAgent === true,
      role: opts.personalAgent ? 'personal' : 'fleet',
      channelSlug: opts.channelSlug,
      tenant: opts.tenant,
      fleet: opts.personalAgent !== true,
    },
  })
  return res
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
  const runnerPath = join(config.repoRoot, 'dist', 'runner.js')
  const { runAgentWork } = require(runnerPath) as {
    runAgentWork: (
      name: string,
      message: string,
      history?: { role: string; content: string }[],
      opts?: { workspaceRoot?: string; workRepo?: string }
    ) => Promise<{ output: string; model: string; confidence: number }>
  }
  const res = await runAgentWork(agentId, message, history, {
    workspaceRoot: resolveWorkspaceForRepo(workRepo),
    workRepo,
  })
  return res
}