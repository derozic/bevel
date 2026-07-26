/**
 * Minimal Slack Web API client (no Bolt dependency required for Phase 0–1).
 * Outbound chat.postMessage + auth.test.
 */

import type { WorkspaceSlackConfig } from './workspace-config'

const SLACK_API = 'https://slack.com/api'

export type SlackApiResult<T = unknown> = {
  ok: boolean
  error?: string
  data?: T
}

async function slackApi<T = unknown>(
  method: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<SlackApiResult<T>> {
  try {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = (await res.json()) as T & { ok?: boolean; error?: string }
    if (!res.ok || (data as { ok?: boolean }).ok === false) {
      return {
        ok: false,
        error:
          (data as { error?: string }).error ||
          `HTTP ${res.status}`,
        data,
      }
    }
    return { ok: true, data }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function authTest(token: string) {
  return slackApi<{
    ok: boolean
    url?: string
    team?: string
    user?: string
    team_id?: string
    user_id?: string
    bot_id?: string
  }>('auth.test', token)
}

export async function postMessage(opts: {
  token: string
  channel: string
  text: string
  blocks?: unknown[]
  threadTs?: string
}) {
  return slackApi<{ ok: boolean; ts?: string; channel?: string }>(
    'chat.postMessage',
    opts.token,
    {
      channel: opts.channel,
      text: opts.text,
      blocks: opts.blocks,
      thread_ts: opts.threadTs,
      unfurl_links: false,
    },
  )
}

/** Post using workspace config; resolves BEVEL slug via channelMap when needed. */
export async function postFromWorkspace(
  cfg: WorkspaceSlackConfig,
  opts: {
    /** Slack channel id (C…) or BEVEL channel slug mapped in channelMap */
    channelOrSlug: string
    text: string
    blocks?: unknown[]
    /** Prefer getValidBotToken() when available (rotation-aware). */
    token?: string
  },
): Promise<SlackApiResult> {
  const token = opts.token || cfg.botToken
  if (!cfg.enabled || !token) {
    return { ok: false, error: 'Slack not connected for this workspace' }
  }
  const channel =
    cfg.channelMap[opts.channelOrSlug] ||
    opts.channelOrSlug
  return postMessage({
    token,
    channel,
    text: opts.text,
    blocks: opts.blocks,
  })
}

/** Block Kit card: agent finished / digest (Phase 1). */
export function bevelEventBlocks(opts: {
  title: string
  body: string
  href: string
  footer?: string
}): unknown[] {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: opts.title.slice(0, 150), emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: opts.body.slice(0, 2900) },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open in BEVEL', emoji: true },
          url: opts.href,
          action_id: 'bevel_open',
        },
      ],
    },
    ...(opts.footer
      ? [
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: opts.footer }],
          },
        ]
      : []),
  ]
}
