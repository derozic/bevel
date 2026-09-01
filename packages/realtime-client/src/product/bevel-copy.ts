import { BEVEL_NAME } from './bevel'

/** User-facing strings for BEVEL surfaces — single source for embed clients. */
export const BEVEL_COPY = {
  openingChannel: 'Opening track…',
  archiveLink: 'Session archive',
  archiveNav: 'Archive',

  channelHint: 'Toggle agents · post · @mention to focus',
  channelsLabel: 'Tracks',
  pinnedLabel: 'Pinned',
  pinnedEmpty: 'Pin conversations you use often.',
  feedLabel: 'feed',
  feedEmpty: 'Mentions and ^escalations land here',
  conversationsLabel: 'Direct',
  loadingChannels: 'Loading tracks…',
  loadingConversations: 'Loading conversations…',
  newChannel: 'New track',
  newConversation: 'New',
  conversationsEmpty: 'Pick an agent below to open a direct thread.',
  humanDmsSoon: 'People DMs (e.g. Peter) need a new room type — not wired yet.',
  agentDirectHint: 'Message opens a private thread. Track chips keep them in the room.',

  connectingChannel: (slug: string) => `Opening ~${slug}…`,
  connectingSession: 'Opening the thread…',
  reconnecting: 'Reconnecting…',

  emptyChannel: (slug: string) =>
    `~${slug} is listening. Drop a line—or @mention an agent and watch them light up.`,
  emptySession: 'Your agents are listening. @mention one to focus, or ask the room.',
  emptyDirectSession: (agentName: string) =>
    `${agentName} is here. Say hello — your message goes straight to them.`,
  emptySessionMulti: (agentNames: string[]) => {
    const names = agentNames.filter(Boolean)
    if (names.length === 0) return BEVEL_COPY.emptySession
    if (names.length === 1) return BEVEL_COPY.emptyDirectSession(names[0]!)
    if (names.length === 2) {
      return `${names[0]} and ${names[1]} are listening. @mention one to focus, or ask the room.`
    }
    return `${names[0]} +${names.length - 1} are listening. @mention one to focus, or ask the room.`
  },

  emptyEmoji: '✦',

  loadEarlier: 'Load earlier messages',
  loadingEarlier: 'Loading earlier messages…',
  historyCaughtUp: 'Beginning of track',

  placeholderChannel: (slug: string, sampleAgent?: string) =>
    sampleAgent
      ? `Say something in ~${slug}… or @${sampleAgent}`
      : `Say something in ~${slug}…`,
  placeholderSession: `Talk to ${BEVEL_NAME}…`,
  placeholderDirectSession: (agentName: string) => `Message ${agentName}…`,

  placeholderWork: (slug: string, sampleAgent?: string) =>
    sampleAgent
      ? `Task for ~${slug} — @${sampleAgent} will use the repo…`
      : `Task for ~${slug} — agents will use the repo…`,

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
    connectionFailed: "Couldn't join this channel.",
    connectionHint: 'Reload to try again.',
    bindFailed: 'Connected, but messages did not load.',
    roomError: (detail: string) => detail || 'Connection dropped.',
    seatReservationRetry: 'Reconnecting…',
    seatReservationFailed: "Couldn't grab a seat in the channel.",
    seatReservationHint: 'Reload to try again.',
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

const JOIN_FAILED: BevelConnectionIssue = {
  title: BEVEL_COPY.errors.connectionFailed,
  hint: BEVEL_COPY.errors.connectionHint,
}

/** Map raw connection failures to short, human copy. Never leak hosts or ports. */
export function resolveBevelConnectionIssue(
  raw: string,
  _ctx: { isChannel: boolean; realtimeUrl: string },
): BevelConnectionIssue {
  const text = (raw ?? '').trim()
  const lower = text.toLowerCase()

  if (
    !text ||
    text === 'undefined' ||
    text === 'null' ||
    /^error\s+undefined$/i.test(text) ||
    /^error\s*$/i.test(text)
  ) {
    return JOIN_FAILED
  }

  if (SEAT_RESERVATION_RE.test(lower)) {
    return {
      title: BEVEL_COPY.errors.seatReservationFailed,
      hint: BEVEL_COPY.errors.seatReservationHint,
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
      hint: 'Refresh, or sign out and sign in again.',
    }
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('econnrefused') ||
    lower.includes('networkerror') ||
    lower.includes('wss is not supported') ||
    lower.includes('scheme wss') ||
    (lower.includes('websocket') && lower.includes('error')) ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('abnormal close') ||
    lower.includes('1006') ||
    lower.includes('not defined') ||
    (lower.includes('fleet_channel') &&
      (lower.includes('not found') ||
        lower.includes('does not exist') ||
        lower.includes('not registered') ||
        lower.includes('provided room name')))
  ) {
    return JOIN_FAILED
  }

  return JOIN_FAILED
}