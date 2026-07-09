import { createRequire } from 'node:module'
import { join } from 'node:path'
import { config } from './config.js'
import { resolveWorkspaceForRepo } from './work-repos.js'

const require = createRequire(import.meta.url)

export async function dispatchAgentChat(
  agentId: string,
  message: string,
  history: { role: string; content: string }[] = []
): Promise<{ output: string; model?: string; confidence?: number }> {
  const runnerPath = join(config.repoRoot, 'dist', 'runner.js')
  const { runAgentChat } = require(runnerPath) as {
    runAgentChat: (
      name: string,
      message: string,
      history?: { role: string; content: string }[]
    ) => Promise<{ output: string; model: string; confidence: number }>
  }
  const res = await runAgentChat(agentId, message, history)
  return res
}

export async function dispatchAgentWork(
  agentId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  workRepo = config.workRepo
): Promise<{ output: string; model?: string; confidence?: number }> {
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