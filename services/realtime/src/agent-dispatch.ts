import { createRequire } from 'node:module'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { config } from './config.js'
import { resolveWorkspaceForRepo } from './work-repos.js'
import { sanitizeAgentError } from './sanitize-agent-error.js'
import { emitDispatchTrace, newRunId, type TraceEmitContext } from './trace-emit.js'

const require = createRequire(import.meta.url)

export type DispatchResult = {
  output: string
  model?: string
  confidence?: number
  runId?: string
}

export type DispatchOptions = {
  /** Optional trace room context; when set, emits AgentTrace events */
  trace?: TraceEmitContext
}

function runnerPath(): string {
  return join(config.repoRoot, 'dist', 'runner.js')
}

function loadRunner(): {
  runAgentChat: (
    name: string,
    message: string,
    history?: { role: string; content: string }[],
  ) => Promise<{ output: string; model: string; confidence: number }>
  runAgentWork: (
    name: string,
    message: string,
    history?: { role: string; content: string }[],
    opts?: { workspaceRoot?: string; workRepo?: string },
  ) => Promise<{ output: string; model: string; confidence: number }>
} {
  const path = runnerPath()
  if (!existsSync(path)) {
    throw new Error(
      `Cannot find module '${path}' — set AGENTS_REPO_ROOT to the agents package root (e.g. /opt/bevel/agents)`,
    )
  }
  return require(path) as ReturnType<typeof loadRunner>
}

async function withTrace<T extends DispatchResult>(
  agentId: string,
  mode: 'chat' | 'work',
  opts: DispatchOptions | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const runId = newRunId()
  const started = Date.now()
  const trace = opts?.trace

  if (trace) {
    void emitDispatchTrace({
      ctx: { ...trace, agentId },
      runId,
      phase: 'start',
      title: mode === 'work' ? `Dispatch work @${agentId}` : `Dispatch chat @${agentId}`,
      summary: mode,
    })
  }

  try {
    const res = await fn()
    if (trace) {
      void emitDispatchTrace({
        ctx: { ...trace, agentId },
        runId,
        phase: 'ok',
        title: `@${agentId} replied`,
        summary: (res.output || '').slice(0, 200),
        model: res.model,
        durationMs: Date.now() - started,
      })
    }
    return { ...res, runId }
  } catch (err) {
    const sanitized = sanitizeAgentError(agentId, err)
    // Always log redacted detail server-side
    console.error(
      `[agent-dispatch] ${agentId} ${sanitized.code}: ${sanitized.detail}`,
    )
    if (trace) {
      void emitDispatchTrace({
        ctx: { ...trace, agentId },
        runId,
        phase: 'error',
        title: `@${agentId} failed`,
        summary: sanitized.publicMessage,
        errorCode: sanitized.code,
        durationMs: Date.now() - started,
      })
    }
    // Re-throw a clean Error so channel code can sanitize again without Axios dumps
    const clean = new Error(sanitized.publicMessage)
    ;(clean as Error & { code?: string }).code = sanitized.code
    throw clean
  }
}

const DISPATCH_TIMEOUT_MS = Number(process.env.AGENT_DISPATCH_TIMEOUT_MS ?? 60_000)

async function withTimeout<T>(label: string, ms: number, fn: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function dispatchAgentChat(
  agentId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  opts?: DispatchOptions,
): Promise<DispatchResult> {
  return withTrace(agentId, 'chat', opts, async () => {
    console.log(`[agent-dispatch] start chat @${agentId}`)
    const { runAgentChat } = loadRunner()
    const res = await withTimeout(
      `chat @${agentId}`,
      DISPATCH_TIMEOUT_MS,
      () => runAgentChat(agentId, message, history),
    )
    console.log(
      `[agent-dispatch] ok chat @${agentId} model=${res.model ?? '?'} chars=${(res.output || '').length}`,
    )
    return res
  })
}

export async function dispatchAgentWork(
  agentId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  workRepo = config.workRepo,
  opts?: DispatchOptions,
): Promise<DispatchResult> {
  return withTrace(agentId, 'work', opts, async () => {
    console.log(`[agent-dispatch] start work @${agentId} repo=${workRepo}`)
    const { runAgentWork } = loadRunner()
    const res = await withTimeout(
      `work @${agentId}`,
      DISPATCH_TIMEOUT_MS,
      () =>
        runAgentWork(agentId, message, history, {
          workspaceRoot: resolveWorkspaceForRepo(workRepo),
          workRepo,
        }),
    )
    console.log(
      `[agent-dispatch] ok work @${agentId} model=${res.model ?? '?'} chars=${(res.output || '').length}`,
    )
    return res
  })
}

/** Re-export for room error paths that catch non-dispatch errors */
export { sanitizeAgentError }
