import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './config.js'
import { createSessionRecorder, type SessionRecorder } from './session-recorder.js'

let recorder: SessionRecorder | null = null

function getRecorder(): SessionRecorder {
  if (!recorder) {
    recorder = createSessionRecorder((event) => {
      const dir = sessionsDir()
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      appendFileSync(sessionPath(event.sessionId), `${JSON.stringify(event)}\n`, 'utf8')
    })
  }
  return recorder
}

export type SessionEvent = {
  ts: number
  sessionId: string
  type: 'message' | 'status' | 'join' | 'leave' | 'agent_reply'
  speaker: string
  speakerType: 'human' | 'agent' | 'system'
  agentId?: string
  body: string
  meta?: Record<string, unknown>
}

export type SessionSummary = {
  sessionId: string
  title: string
  agentIds: string[]
  createdAt: number
  updatedAt: number
  messageCount: number
  preview?: string
}

function sessionsDir(): string {
  if (config.recordingsDir) return config.recordingsDir
  return join(config.repoRoot, 'data', 'sessions')
}

function sessionPath(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(sessionsDir(), `${safe}.jsonl`)
}

export function recordEvent(event: SessionEvent): void {
  void getRecorder().record(event)
}

export function listRecordings(): string[] {
  const dir = sessionsDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => f.replace(/\.jsonl$/, ''))
}

function parseAgentIdsFromStatus(body: string): string[] {
  const match = body.match(/agents:\s*(.+)$/i)
  if (!match) return []
  return match[1].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

export function summarizeRecording(sessionId: string): SessionSummary | null {
  const path = sessionPath(sessionId)
  if (!existsSync(path)) return null

  const events = readRecording(sessionId)
  const fileStat = statSync(path)
  const status = events.find((e) => e.type === 'status')
  const meta = status?.meta as { title?: string; agentIds?: string[] } | undefined
  const agentIds =
    meta?.agentIds?.map((id) => id.toLowerCase()) ??
    (status ? parseAgentIdsFromStatus(status.body) : [])

  const conversational = events.filter(
    (e) => e.type === 'message' || e.type === 'agent_reply'
  )
  const lastLine = [...conversational].reverse()[0]

  const createdAt = events[0]?.ts ?? fileStat.birthtimeMs
  const updatedAt = events[events.length - 1]?.ts ?? fileStat.mtimeMs

  let title = meta?.title
  if (!title) {
    title = agentIds.length ? agentIds.join(', ') : 'Fleet session'
  }

  return {
    sessionId,
    title,
    agentIds,
    createdAt,
    updatedAt,
    messageCount: conversational.length,
    preview: lastLine?.body?.slice(0, 120),
  }
}

export function listSessionSummaries(): SessionSummary[] {
  return listRecordings()
    .map((id) => summarizeRecording(id))
    .filter((s): s is SessionSummary => s !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function readRecording(sessionId: string): SessionEvent[] {
  const path = sessionPath(sessionId)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionEvent)
}