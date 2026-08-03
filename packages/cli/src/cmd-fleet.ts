/**
 * Agent-first fleet CLI — JSON stdout, structured errors, exit codes.
 * Mirrors MCP tools for channels / messages / agents / search / workflows.
 */
import {
  apiBase,
  defaultTenant,
  fleetFetch,
  parseFlags,
  printJson,
  type FleetExit,
} from './fleet-api.js'

function flagStr(flags: Record<string, string | boolean>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = flags[k]
    if (typeof v === 'string' && v) return v
  }
  return undefined
}

function exitWith(code: FleetExit, data: unknown): never {
  printJson(data)
  process.exit(code)
}

export async function cmdChannels(argv: string[]): Promise<void> {
  const { flags, positional } = parseFlags(argv)
  const sub = positional[0] || 'list'
  const tenant = flagStr(flags, 'tenant', 't') || defaultTenant()

  if (sub === 'list') {
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels?tenant=${encodeURIComponent(tenant)}`,
    )
    exitWith(exit, data)
  }
  if (sub === 'get') {
    const slug = positional[1] || flagStr(flags, 'channel', 'c')
    if (!slug) {
      exitWith(1, { ok: false, error: 'Usage: bevel channels get <slug> [--tenant 2x4m]' })
    }
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(slug)}?tenant=${encodeURIComponent(tenant)}`,
    )
    exitWith(exit, data)
  }
  exitWith(1, {
    ok: false,
    error: 'Usage: bevel channels list|get <slug> [--tenant 2x4m]',
  })
}

export async function cmdMessages(argv: string[]): Promise<void> {
  const { flags, positional } = parseFlags(argv)
  const sub = positional[0] || 'list'
  const tenant = flagStr(flags, 'tenant', 't') || defaultTenant()
  const channel = flagStr(flags, 'channel', 'c') || positional[1]

  if (sub === 'list') {
    if (!channel) {
      exitWith(1, {
        ok: false,
        error: 'Usage: bevel messages list --channel general [--tenant 2x4m] [--limit 50]',
      })
    }
    const limit = flagStr(flags, 'limit') || '50'
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(channel)}/messages?tenant=${encodeURIComponent(tenant)}&limit=${encodeURIComponent(limit)}`,
    )
    exitWith(exit, data)
  }

  if (sub === 'post') {
    if (!channel) {
      exitWith(1, {
        ok: false,
        error:
          'Usage: bevel messages post --channel general --body "..." [--agent brain] [--tenant 2x4m]',
      })
    }
    const body = flagStr(flags, 'body', 'message', 'm')
    if (!body) {
      exitWith(1, { ok: false, error: '--body required' })
    }
    const agent = flagStr(flags, 'agent', 'a')
    const payload: Record<string, unknown> = {
      body,
      speakerId: agent ? `agent:${agent}` : 'cli:operator',
      speakerName: agent || 'cli',
      speakerType: agent ? 'agent' : 'human',
      status: 'final',
    }
    if (agent) payload.agentId = agent
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(channel)}/messages?tenant=${encodeURIComponent(tenant)}`,
      { method: 'POST', body: JSON.stringify(payload) },
    )
    exitWith(exit, data)
  }

  if (sub === 'search') {
    const q = flagStr(flags, 'q', 'query') || positional[1]
    if (!q) {
      exitWith(1, {
        ok: false,
        error: 'Usage: bevel messages search --q "OOM" [--channel general] [--tenant 2x4m]',
      })
    }
    const qs = new URLSearchParams({
      q,
      tenant,
      limit: flagStr(flags, 'limit') || '50',
    })
    if (channel) qs.set('channel', channel)
    const { data, exit } = await fleetFetch(`/api/v1/fleet/search?${qs}`)
    exitWith(exit, data)
  }

  exitWith(1, {
    ok: false,
    error: 'Usage: bevel messages list|post|search ...',
    api: apiBase(),
  })
}

export async function cmdAgents(argv: string[]): Promise<void> {
  const { flags, positional } = parseFlags(argv)
  const sub = positional[0] || 'list'
  const tenant = flagStr(flags, 'tenant', 't') || defaultTenant()
  const channel = flagStr(flags, 'channel', 'c')

  if (sub === 'list') {
    // Catalog
    const catalog = await fleetFetch('/api/v1/agents')
    if (channel) {
      const members = await fleetFetch(
        `/api/v1/fleet/channels/${encodeURIComponent(channel)}/agents?tenant=${encodeURIComponent(tenant)}`,
      )
      exitWith(members.exit || catalog.exit, {
        catalog: catalog.data,
        members: members.data,
        tenant,
        channel,
      })
    }
    exitWith(catalog.exit, catalog.data)
  }

  if (sub === 'members') {
    if (!channel) {
      exitWith(1, {
        ok: false,
        error: 'Usage: bevel agents members --channel general [--tenant 2x4m]',
      })
    }
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(channel)}/agents?tenant=${encodeURIComponent(tenant)}`,
    )
    exitWith(exit, data)
  }

  if (sub === 'add') {
    const agent = flagStr(flags, 'agent', 'a') || positional[1]
    if (!channel || !agent) {
      exitWith(1, {
        ok: false,
        error: 'Usage: bevel agents add --channel general --agent brain',
      })
    }
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(channel)}/agents/${encodeURIComponent(agent)}?tenant=${encodeURIComponent(tenant)}`,
      { method: 'PUT', body: JSON.stringify({ addedBy: 'cli' }) },
    )
    exitWith(exit, data)
  }

  if (sub === 'remove') {
    const agent = flagStr(flags, 'agent', 'a') || positional[1]
    if (!channel || !agent) {
      exitWith(1, {
        ok: false,
        error: 'Usage: bevel agents remove --channel general --agent brain',
      })
    }
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(channel)}/agents/${encodeURIComponent(agent)}?tenant=${encodeURIComponent(tenant)}`,
      { method: 'DELETE' },
    )
    exitWith(exit, data)
  }

  if (sub === 'ask') {
    // Post @mention into channel so fleet/realtime (or workflows) can pick it up
    const agent = flagStr(flags, 'agent', 'a') || positional[1]
    const message = flagStr(flags, 'message', 'm', 'body') || positional[2]
    if (!channel || !agent || !message) {
      exitWith(1, {
        ok: false,
        error:
          'Usage: bevel agents ask --channel general --agent brain --message "..." [--tenant 2x4m]',
      })
    }
    // Ensure membership first
    await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(channel)}/agents/${encodeURIComponent(agent)}?tenant=${encodeURIComponent(tenant)}`,
      { method: 'PUT', body: JSON.stringify({ addedBy: 'cli' }) },
    )
    const body = message.includes(`@${agent}`) ? message : `@${agent} ${message}`
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(channel)}/messages?tenant=${encodeURIComponent(tenant)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          body,
          speakerId: 'cli:operator',
          speakerName: 'cli',
          speakerType: 'human',
          status: 'final',
          tags: ['cli', 'agent-ask'],
        }),
      },
    )
    exitWith(exit, {
      ok: exit === 0,
      note: 'Message posted with @mention. Live realtime clients dispatch the agent; check Trace pane / messages list.',
      result: data,
      agent,
      channel,
      tenant,
    })
  }

  exitWith(1, {
    ok: false,
    error: 'Usage: bevel agents list|members|add|remove|ask ...',
  })
}

export async function cmdWorkflows(argv: string[]): Promise<void> {
  const { flags, positional } = parseFlags(argv)
  const sub = positional[0] || 'list'
  const tenant = flagStr(flags, 'tenant', 't') || defaultTenant()
  const channel = flagStr(flags, 'channel', 'c') || positional[1]

  if (sub === 'list') {
    if (!channel) {
      exitWith(1, { ok: false, error: 'Usage: bevel workflows list --channel general' })
    }
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(channel)}/workflows?tenant=${encodeURIComponent(tenant)}`,
    )
    exitWith(exit, data)
  }

  if (sub === 'create' || sub === 'upsert') {
    if (!channel) {
      exitWith(1, {
        ok: false,
        error:
          'Usage: bevel workflows create --channel general --name incident --definition \'{"trigger":{"on":"message_posted","filter":"contains:P1"},"steps":[{"action":"mention_agent","agent":"johnny"}]}\'',
      })
    }
    const name = flagStr(flags, 'name', 'n') || 'workflow'
    let definition: Record<string, unknown> = {}
    const defRaw = flagStr(flags, 'definition', 'def', 'd')
    if (defRaw) {
      try {
        definition = JSON.parse(defRaw) as Record<string, unknown>
      } catch {
        exitWith(1, { ok: false, error: 'definition must be valid JSON' })
      }
    } else {
      // Sensible default: P1 → @johnny
      definition = {
        name,
        trigger: { on: 'message_posted', filter: 'contains:P1' },
        steps: [{ id: 'ping', action: 'mention_agent', agent: 'johnny' }],
      }
    }
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(channel)}/workflows?tenant=${encodeURIComponent(tenant)}`,
      {
        method: 'POST',
        body: JSON.stringify({ name, enabled: true, definition }),
      },
    )
    exitWith(exit, data)
  }

  if (sub === 'delete') {
    const id = flagStr(flags, 'id') || positional[2]
    if (!channel || !id) {
      exitWith(1, {
        ok: false,
        error: 'Usage: bevel workflows delete --channel general --id cwf_...',
      })
    }
    const { data, exit } = await fleetFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(channel)}/workflows/${encodeURIComponent(id)}?tenant=${encodeURIComponent(tenant)}`,
      { method: 'DELETE' },
    )
    exitWith(exit, data)
  }

  exitWith(1, {
    ok: false,
    error: 'Usage: bevel workflows list|create|delete ...',
  })
}
