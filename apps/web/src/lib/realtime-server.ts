import { auth } from '@/auth'
import {
  type SessionEvent,
  type SessionSummary,
} from './realtime'

/** Server-side fetches bypass Caddy TLS — hit Colyseus directly on REALTIME_PORT. */
export function serverRealtimeUrl(): string {
  if (process.env.REALTIME_SERVER_URL) return process.env.REALTIME_SERVER_URL
  const port = process.env.REALTIME_PORT ?? '43208'
  return `http://127.0.0.1:${port}`
}

async function authHeaders(): Promise<HeadersInit> {
  const session = await auth()
  const token = session?.realtimeToken
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export class RealtimeAuthError extends Error {
  constructor() {
    super('Sign in required to load fleet sessions')
    this.name = 'RealtimeAuthError'
  }
}

export async function fetchSessionSummaries(): Promise<SessionSummary[]> {
  const headers = await authHeaders()
  if (!('Authorization' in headers)) {
    throw new RealtimeAuthError()
  }

  const res = await fetch(`${serverRealtimeUrl()}/api/sessions`, {
    headers,
    next: { revalidate: 15 },
  })
  if (res.status === 401) throw new RealtimeAuthError()
  if (!res.ok) return []
  const data = (await res.json()) as { sessions: SessionSummary[] }
  return data.sessions ?? []
}

export async function fetchSessionTranscript(id: string): Promise<SessionEvent[]> {
  const headers = await authHeaders()
  if (!('Authorization' in headers)) {
    throw new RealtimeAuthError()
  }

  const res = await fetch(
    `${serverRealtimeUrl()}/api/sessions/${encodeURIComponent(id)}/transcript`,
    {
      headers,
      next: { revalidate: 15 },
    }
  )
  if (res.status === 401) throw new RealtimeAuthError()
  if (!res.ok) return []
  const data = (await res.json()) as { events: SessionEvent[] }
  return data.events ?? []
}