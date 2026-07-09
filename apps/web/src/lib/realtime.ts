import { resolveRealtimeUrl } from './realtime-client'

export type SessionSummary = {
  sessionId: string
  title: string
  agentIds: string[]
  messageCount: number
  preview?: string
  updatedAt: number
  createdAt: number
}

export type SessionEvent = {
  ts: number
  speaker: string
  speakerType: string
  body: string
  type: string
}

export function realtimeUrl(): string {
  return resolveRealtimeUrl()
}

export function formatSessionWhen(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}