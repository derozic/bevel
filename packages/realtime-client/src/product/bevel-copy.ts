import { BEVEL_NAME } from './bevel'

/** User-facing strings for BEVEL surfaces — single source for embed clients. */
export const BEVEL_COPY = {
  openingChannel: 'Opening channel…',
  archiveLink: 'Session archive',
  archiveNav: 'Archive',

  channelHint: 'Toggle agents · post · @mention to focus',
  channelsLabel: 'Channels',
  conversationsLabel: 'Direct',
  loadingChannels: 'Loading channels…',
  loadingConversations: 'Loading conversations…',
  newChannel: 'New channel',
  newConversation: 'New',
  conversationsEmpty: 'Pick an agent below to open a direct thread.',
  humanDmsSoon: 'People DMs (e.g. Peter) need a new room type — not wired yet.',
  agentDirectHint: 'Message opens a private thread. Channel chips keep them in the room.',

  connectingChannel: (slug: string) => `Waking up ^${slug}…`,
  connectingSession: 'Dialing in…',
  reconnecting: 'Back in a sec…',

  emptyChannel: (slug: string) =>
    `^${slug} is listening. Drop a line—or @mention an agent and watch them light up.`,
  emptySession: 'Your agents are listening. @mention one to focus, or ask the room.',
  emptyDirectSession: (agentName: string) =>
    `${agentName} is here. Say hello — your message goes straight to them.`,
  emptySessionMulti: (agentNames: string[]) =>
    agentNames.length === 2
      ? `${agentNames[0]} and ${agentNames[1]} are listening. @mention one to focus, or ask the room.`
      : `${agentNames[0]} +${agentNames.length - 1} are listening. @mention one to focus, or ask the room.`,

  emptyEmoji: '✦',

  placeholderChannel: (slug: string, sampleAgent?: string) =>
    sampleAgent
      ? `Say something in ^${slug}… or @${sampleAgent}`
      : `Say something in ^${slug}…`,
  placeholderSession: `Talk to ${BEVEL_NAME}…`,
  placeholderDirectSession: (agentName: string) => `Message ${agentName}…`,

  placeholderWork: (slug: string, sampleAgent?: string) =>
    sampleAgent
      ? `Task for ^${slug} — @${sampleAgent} will use the repo…`
      : `Task for ^${slug} — agents will use the repo…`,

  work: {
    toggle: 'Work',
    toggleOn: 'Work mode — agents use the repo',
    toggleOff: 'Chat mode — agents advise only',
    ticket: 'Ticket',
    ticketOn: 'File a GitHub issue before dispatch',
    ticketOff: 'Chat only — no GitHub issue',
    ticketCreating: 'Opening ticket…',
    ticketFailed: 'Could not open ticket',
    repoLabel: (repo: string) => `Repo: ${repo}`,
    pickRepo: 'Target repo',
    linkGitHub: 'Link GitHub for work mode',
    linkGitHubHint: (repo: string) =>
      `Connect GitHub with write access to ${repo} to put agents on real tasks.`,
    denied: (repo: string) =>
      `Write access to ${repo} required to put agents on work.`,
    dispatched: 'Putting agents on work…',
  },

  auth: {
    signInRequired: `Sign in with Google Workspace to open ${BEVEL_NAME}.`,
    missingRealtimeToken:
      'Session expired. Sign out and sign in again to reconnect.',
    joinRequired: 'Sign in to join this channel.',
  },

  errors: {
    connectionFailed: 'Could not connect to the channel.',
    bindFailed: 'Connected but failed to load messages.',
    roomError: (detail: string) => detail || 'Connection dropped.',
    seatReservationRetry: 'Reconnecting…',
    seatReservationFailed: "Couldn't grab a seat in the channel.",
    seatReservationHint: 'Reload the page — realtime may have restarted.',
  },
} as const

export type BevelConnectionIssue = {
  title: string
  hint?: string
}

const SEAT_RESERVATION_RE = /seat reservation/i

/** Colyseus matchmaker reservation timed out before the room handshake finished. */
export function isSeatReservationExpired(raw: string): boolean {
  return SEAT_RESERVATION_RE.test(raw)
}

/** Map raw connection failures to operator-friendly copy (dev hints stay actionable). */
export function resolveBevelConnectionIssue(
  raw: string,
  ctx: { isChannel: boolean; realtimeUrl: string }
): BevelConnectionIssue {
  const text = (raw ?? '').trim()
  const lower = text.toLowerCase()

  // Colyseus / browser garbage: "error undefined", empty, bare "undefined"
  if (
    !text ||
    text === 'undefined' ||
    text === 'null' ||
    /^error\s+undefined$/i.test(text) ||
    /^error\s*$/i.test(text)
  ) {
    return {
      title: BEVEL_COPY.errors.connectionFailed,
      hint: ctx.isChannel
        ? `Could not stay connected to the channel. Check realtime (${ctx.realtimeUrl}/health) and reload.`
        : ctx.realtimeUrl,
    }
  }

  if (SEAT_RESERVATION_RE.test(lower)) {
    return {
      title: BEVEL_COPY.errors.seatReservationFailed,
      hint: BEVEL_COPY.errors.seatReservationHint,
    }
  }

  // Room type not registered on this process (not every error that mentions fleet_channel)
  if (
    lower.includes('not defined') ||
    (lower.includes('fleet_channel') &&
      (lower.includes('not found') ||
        lower.includes('does not exist') ||
        lower.includes('not registered') ||
        lower.includes('provided room name')))
  ) {
    return {
      title: 'Channel mode is not available on realtime',
      hint: 'Restart the BEVEL realtime service (port 43208), then reload.',
    }
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('econnrefused') ||
    lower.includes('networkerror')
  ) {
    return {
      title: "Can't reach BEVEL realtime",
      hint: `Start the realtime tab, then reload. (${ctx.realtimeUrl})`,
    }
  }

  if (lower.includes('websocket') && lower.includes('error')) {
    return {
      title: "Can't reach BEVEL realtime",
      hint: `WebSocket failed. Check ${ctx.realtimeUrl}/health`,
    }
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return ctx.isChannel
      ? {
          title: 'Timed out joining the channel',
          hint: 'Check that realtime is running (https://realtime.bevel.lvh.me/health).',
        }
      : {
          title: 'Connection timed out',
          hint: ctx.realtimeUrl,
        }
  }

  if (
    lower.includes('401') ||
    lower.includes('sign in') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid or expired')
  ) {
    return {
      title: 'Sign in required',
      hint: 'Refresh the page or sign out and sign in again.',
    }
  }

  if (lower.includes('abnormal close') || lower.includes('1006')) {
    return {
      title: BEVEL_COPY.errors.connectionFailed,
      hint: ctx.isChannel
        ? 'The channel socket closed early. Reload — realtime may have restarted.'
        : ctx.realtimeUrl,
    }
  }

  return { title: text || BEVEL_COPY.errors.connectionFailed }
}