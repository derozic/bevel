/**
 * Best-effort log of agent key moves into BEVEL ^product (via web API).
 */

function webBase(): string {
  return (
    process.env.BEVEL_WEB_INTERNAL_URL ||
    process.env.BEVEL_WEB_URL ||
    'http://127.0.0.1:43200'
  )
}

export async function logAgentWorkToProduct(input: {
  agentId: string
  agentName?: string
  title: string
  body?: string
  repo?: string
  url?: string
}): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const key = process.env.FLEET_INTERNAL_API_KEY
    if (key) headers['X-Fleet-Internal-Key'] = key

    await fetch(`${webBase()}/api/github/agent-activity`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        kind: 'work_dispatch',
        agentId: input.agentId,
        agentName: input.agentName,
        title: input.title,
        body: input.body,
        repo: input.repo,
        url: input.url,
      }),
    })
  } catch {
    // Accountability log is best-effort — never block agent replies
  }
}
