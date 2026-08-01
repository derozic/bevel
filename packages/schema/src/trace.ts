/**
 * Agent Trace — human + machine readable agent action log (parallel to chat).
 * See docs/AGENT_TRACE.md (added with API) and plan: Agent Tracing.
 */
import { z } from 'zod'

export const TRACE_SCHEMA_VERSION = 1 as const

export const TraceRoomKindSchema = z.enum([
  'channel',
  'agent_session',
  'computer',
  'cloud',
])
export type TraceRoomKind = z.infer<typeof TraceRoomKindSchema>

export const TraceEventKindSchema = z.enum([
  'run_start',
  'run_end',
  'run_error',
  'thinking',
  'planning',
  'tool_call',
  'tool_result',
  'computer',
  'browser',
  'shell',
  'file',
  'network',
  'handoff',
  'delegate',
  'await',
  'resume',
  'model',
  'token_usage',
  'status',
  'custom',
])
export type TraceEventKind = z.infer<typeof TraceEventKindSchema>

export const TraceEventStatusSchema = z.enum([
  'pending',
  'running',
  'ok',
  'error',
  'cancelled',
])
export type TraceEventStatus = z.infer<typeof TraceEventStatusSchema>

export const TraceRedactionSchema = z.enum([
  'none',
  'partial',
  'secrets_stripped',
])
export type TraceRedaction = z.infer<typeof TraceRedactionSchema>

export const TraceRunStatusSchema = z.enum([
  'running',
  'ok',
  'error',
  'cancelled',
])
export type TraceRunStatus = z.infer<typeof TraceRunStatusSchema>

/** One agent action step — dual human/machine payload. */
export const AgentTraceEventSchema = z.object({
  id: z.string().min(1).max(64),
  schemaVersion: z.literal(TRACE_SCHEMA_VERSION).default(TRACE_SCHEMA_VERSION),
  tenantId: z.string().min(1),
  runId: z.string().min(1).max(64),
  parentRunId: z.string().max(64).optional(),
  spanId: z.string().max(64).optional(),
  parentSpanId: z.string().max(64).optional(),

  roomKind: TraceRoomKindSchema,
  roomId: z.string().min(1).max(256),
  messageId: z.string().max(128).optional(),
  agentId: z.string().min(1).max(64),
  actor: z.string().max(320).optional(),

  ts: z.string().datetime({ offset: true }).or(z.string().datetime()),
  durationMs: z.number().int().nonnegative().optional(),

  kind: TraceEventKindSchema,
  title: z.string().min(1).max(500),
  summary: z.string().max(4000).optional(),
  bodyMarkdown: z.string().max(32_000).optional(),

  payload: z.record(z.string(), z.unknown()).default({}),
  status: TraceEventStatusSchema.default('ok'),
  redaction: TraceRedactionSchema.default('none'),
})
export type AgentTraceEvent = z.infer<typeof AgentTraceEventSchema>

/** Ingest body: client may omit id/ts/schemaVersion (server fills). */
export const AgentTraceEventIngestSchema = AgentTraceEventSchema.partial({
  id: true,
  schemaVersion: true,
  ts: true,
  status: true,
  redaction: true,
  payload: true,
}).required({
  tenantId: true,
  runId: true,
  roomKind: true,
  roomId: true,
  agentId: true,
  kind: true,
  title: true,
})
export type AgentTraceEventIngest = z.infer<typeof AgentTraceEventIngestSchema>

export const AgentTraceBatchIngestSchema = z.object({
  events: z.array(AgentTraceEventIngestSchema).min(1).max(100),
})
export type AgentTraceBatchIngest = z.infer<typeof AgentTraceBatchIngestSchema>

export const AgentRunSchema = z.object({
  id: z.string().min(1).max(64),
  tenantId: z.string().min(1),
  roomKind: TraceRoomKindSchema,
  roomId: z.string().min(1).max(256),
  agentId: z.string().min(1).max(64),
  parentRunId: z.string().max(64).optional(),
  messageId: z.string().max(128).optional(),
  status: TraceRunStatusSchema,
  title: z.string().max(500).optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
})
export type AgentRun = z.infer<typeof AgentRunSchema>

export const AgentRunOpenSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  tenantId: z.string().min(1),
  roomKind: TraceRoomKindSchema,
  roomId: z.string().min(1).max(256),
  agentId: z.string().min(1).max(64),
  parentRunId: z.string().max(64).optional(),
  messageId: z.string().max(128).optional(),
  title: z.string().max(500).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})
export type AgentRunOpen = z.infer<typeof AgentRunOpenSchema>

export const AgentRunCloseSchema = z.object({
  status: TraceRunStatusSchema.exclude(['running']),
  title: z.string().max(500).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})
export type AgentRunClose = z.infer<typeof AgentRunCloseSchema>
