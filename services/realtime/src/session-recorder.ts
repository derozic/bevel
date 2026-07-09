import type { SessionEvent } from './recording.js'

export interface SessionRecorder {
  record(event: SessionEvent): void | Promise<void>
}

export class JsonlSessionRecorder implements SessionRecorder {
  constructor(private append: (event: SessionEvent) => void) {}

  record(event: SessionEvent): void {
    this.append(event)
  }
}

/** POST events to partner API (2x4m /api/v1/agent-sessions). */
export class ApiSessionRecorder implements SessionRecorder {
  private ensured = new Set<string>()

  constructor(
    private baseUrl: string,
    private getAuthHeader: () => string | undefined
  ) {}

  async record(event: SessionEvent): Promise<void> {
    const auth = this.getAuthHeader()
    if (!auth) return

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`,
    }

    if (!this.ensured.has(event.sessionId)) {
      this.ensured.add(event.sessionId)
      await fetch(`${this.baseUrl}/api/v1/agent-sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: event.sessionId,
          title: (event.meta?.title as string) ?? 'Fleet session',
          agentIds: (event.meta?.agentIds as string[]) ?? [],
        }),
      }).catch(() => {
        this.ensured.delete(event.sessionId)
      })
    }

    await fetch(`${this.baseUrl}/api/v1/agent-sessions/${encodeURIComponent(event.sessionId)}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ts: event.ts,
        type: event.type,
        speaker: event.speaker,
        speakerType: event.speakerType,
        agentId: event.agentId,
        body: event.body,
        meta: event.meta,
      }),
    }).catch(() => undefined)
  }
}

export function createSessionRecorder(
  jsonlAppend: (event: SessionEvent) => void
): SessionRecorder {
  const apiUrl = process.env.FLEET_SESSION_API_URL
  if (apiUrl) {
    const serviceToken = process.env.FLEET_SESSION_SERVICE_TOKEN
    return new ApiSessionRecorder(apiUrl.replace(/\/$/, ''), () =>
      serviceToken ? `Bearer ${serviceToken}` : undefined
    )
  }
  return new JsonlSessionRecorder(jsonlAppend)
}