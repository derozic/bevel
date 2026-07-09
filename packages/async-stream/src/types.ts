/** Async stream events — AI responses, progress, notifications, activity, jobs */

export type AsyncStreamEventType =
  | 'ai.delta'
  | 'ai.done'
  | 'progress'
  | 'notification'
  | 'activity'
  | 'job.started'
  | 'job.updated'
  | 'job.completed'
  | 'job.failed'

export type AsyncStreamEvent = {
  id: string
  tenantId: string
  namespace: string
  type: AsyncStreamEventType
  timestamp: string
  payload: Record<string, unknown>
}

export function formatSseMessage(event: AsyncStreamEvent): string {
  return [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    '',
    '',
  ].join('\n')
}