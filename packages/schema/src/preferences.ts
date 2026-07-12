import { z } from 'zod'

export const PREFERENCES_VERSION = 5 as const

export const notifyOnSchema = z.enum(['mentions_dms', 'all', 'nothing'])
export const densitySchema = z.enum(['clean', 'compact'])
export const nameStyleSchema = z.enum(['full_and_display', 'display_only'])
export const tabAppearanceSchema = z.enum(['icons_and_text', 'icons_only'])
export const conversationFilterSchema = z.enum([
  'active',
  'unreads',
  'mentions',
  'all',
])
export const onViewBehaviorSchema = z.enum([
  'resume_and_read',
  'newest_and_read',
  'newest_leave_unread',
])
export const permissionStateSchema = z.enum([
  'prompt',
  'granted',
  'denied',
  'unsupported',
])
export const themeIdSchema = z.enum(['tenant', 'system', 'high_contrast'])
/** Time-of-day look: auto follows local clock (4 parts). */
export const daypartPreferenceSchema = z.enum([
  'auto',
  'morning',
  'midday',
  'afternoon',
  'night',
])
export type DaypartPreference = z.infer<typeof daypartPreferenceSchema>
export type DaypartId = Exclude<DaypartPreference, 'auto'>

/**
 * Frontier + research + local Ollama (Mac) + custom OpenAI-compatible endpoints.
 */
export const AI_PROVIDER_IDS = [
  'claude',
  'openai',
  'gemini',
  'grok',
  'perplexity',
  'ollama',
  'custom',
] as const
export const aiProviderIdSchema = z.enum(AI_PROVIDER_IDS)
export type AiProviderId = z.infer<typeof aiProviderIdSchema>

/** Default Ollama OpenAI-compatible base on macOS / localhost. */
export const OLLAMA_DEFAULT_BASE_URL = 'http://127.0.0.1:11434/v1'

const aiProviderStateSchema = z.object({
  enabled: z.boolean(),
  configured: z.boolean(),
  keyPreview: z.string().optional(),
})

export const SOCIAL_NETWORKS = [
  'x',
  'instagram',
  'tiktok',
  'youtube',
] as const
export type SocialNetworkId = (typeof SOCIAL_NETWORKS)[number]

export const discoverabilitySchema = z.enum(['email', 'none'])
export const contactSharingSchema = z.enum([
  'all_contacts',
  'workspace_only',
  'none',
])

const socialUrlSchema = z.string().url().or(z.literal('')).optional()

export const bevelUserPreferencesSchema = z.object({
  version: z.number().default(PREFERENCES_VERSION),
  availability: z.object({
    workingHoursEnabled: z.boolean(),
    days: z.enum(['every_day', 'weekdays', 'custom']),
    start: z.string(),
    end: z.string(),
    autoInChannel: z.boolean(),
    autoFocus: z.boolean(),
    autoAfterHours: z.boolean(),
  }),
  notifications: z.object({
    desktopEnabled: z.boolean(),
    mobileEnabled: z.boolean(),
    notifyOn: notifyOnSchema,
    threadReplies: z.boolean(),
    vipBypassPaused: z.boolean(),
    newHuddles: z.boolean(),
    activity: z.object({
      dms: z.boolean(),
      allPostsChannels: z.boolean(),
      reminders: z.boolean(),
    }),
    /**
     * SMS “true sentience”: only when no live presence (desktop browser or
     * Flutter mobile has not marked the message seen/read) after a grace period.
     * Workspace must have Twilio credentials configured.
     */
    sms: z
      .object({
        enabled: z.boolean().default(false),
        phoneE164: z.string().default(''),
        phoneVerified: z.boolean().default(false),
        /** Minutes without presence before SMS (default 5). */
        graceMinutes: z.number().min(1).max(120).default(5),
        /** Fire for mentions / DMs only, or any notifyOn-level message. */
        onlyMentionsAndDms: z.boolean().default(true),
        /**
         * Include vote URLs in SMS (multi-segment = costlier).
         * Default false: reply Y/S/N only (~1 segment).
         */
        includeVoteLinks: z.boolean().default(false),
        /** Quiet hours (local device clock) — suppress SMS. */
        quietHoursEnabled: z.boolean().default(false),
        quietStart: z.string().default('22:00'),
        quietEnd: z.string().default('07:00'),
      })
      .default({
        enabled: false,
        phoneE164: '',
        phoneVerified: false,
        graceMinutes: 5,
        onlyMentionsAndDms: true,
        includeVoteLinks: false,
        quietHoursEnabled: false,
        quietStart: '22:00',
        quietEnd: '07:00',
      }),
  }),
  vip: z.object({
    alwaysNotify: z.boolean(),
    unreadsSection: z.boolean(),
    memberIds: z.array(z.string()),
  }),
  navigation: z.object({
    tabs: z.object({
      home: z.boolean(),
      dms: z.boolean(),
      activity: z.boolean(),
      files: z.boolean(),
      tools: z.boolean(),
      ai: z.boolean(),
    }),
    tabAppearance: tabAppearanceSchema,
    showAgentsInTopBar: z.boolean(),
  }),
  home: z.object({
    channelOrgTips: z.boolean(),
    homeActivityDot: z.boolean(),
    sidebarAlways: z.object({
      unreads: z.boolean(),
      huddles: z.boolean(),
      threads: z.boolean(),
      drafts: z.boolean(),
      directories: z.boolean(),
    }),
    filter: conversationFilterSchema,
  }),
  appearance: z.object({
    themeId: themeIdSchema,
    density: densitySchema,
    /** Day part atmosphere — auto resolves from local time */
    daypart: daypartPreferenceSchema.default('auto'),
  }),
  messages: z.object({
    nameStyle: nameStyleSchema,
    showTyping: z.boolean(),
    clock24h: z.boolean(),
    colorSwatches: z.boolean(),
    /** Show speaker avatars beside messages (humans + agents) */
    showAvatars: z.boolean().default(true),
  }),
  language: z.object({
    locale: z.string(),
    timezoneAuto: z.boolean(),
    timezone: z.string(),
    spellcheck: z.boolean(),
  }),
  accessibility: z.object({
    simplifiedLayout: z.boolean(),
    zoomPercent: z.number().min(70).max(200),
    altTextReminders: z.boolean(),
  }),
  markAsRead: z.object({
    onViewBehavior: onViewBehaviorSchema,
    confirmMarkAll: z.boolean(),
  }),
  /**
   * Microformats-friendly profile (h-card) plus agent-facing context.
   * Tags, description, and attributes help fleet agents route work and
   * address the member correctly without guessing.
   */
  profile: z.object({
    displayName: z.string(),
    honorificPrefix: z.string().optional(),
    givenName: z.string().optional(),
    familyName: z.string().optional(),
    nickname: z.string().optional(),
    handle: z.string(),
    /** Short public note (h-card p-note) — keep under ~280 chars */
    bio: z.string(),
    /**
     * Longer agent-facing brief: how to work with this person, strengths,
     * decision rights, domains they own. Not necessarily public.
     */
    description: z.string().default(''),
    /** Pronouns for correct address (e.g. they/them, she/her) */
    pronouns: z.string().optional(),
    /** IANA timezone if known (e.g. America/Los_Angeles) */
    timezone: z.string().optional(),
    url: z.string().optional(),
    emailPublic: z.boolean(),
    org: z.string().optional(),
    jobTitle: z.string().optional(),
    location: z.string().optional(),
    photoUrl: z.string().optional(),
    /**
     * Capability / domain / role tags (skills, stacks, focus areas).
     * Normalized lowercase when saved from the UI when possible.
     */
    tags: z.array(z.string()).default([]),
    /**
     * Structured name-value facts agents can cite
     * (e.g. Languages → EN, FR · On-call → primary · Tools → Figma).
     */
    attributes: z
      .array(
        z.object({
          key: z.string(),
          value: z.string(),
        }),
      )
      .default([]),
    socials: z.object({
      x: z.string().default(''),
      instagram: z.string().default(''),
      tiktok: z.string().default(''),
      youtube: z.string().default(''),
    }),
  }),
  account: z.object({
    displayNameSource: z.enum(['google', 'profile', 'custom']),
  }),
  /** Audio & video device preferences */
  media: z.object({
    cameraPermission: permissionStateSchema,
    microphonePermission: permissionStateSchema,
    preferredCameraId: z.string().optional(),
    preferredMicId: z.string().optional(),
    preferredSpeakerId: z.string().optional(),
    autoGainControl: z.boolean(),
    noiseSuppression: z.boolean(),
    echoCancellation: z.boolean(),
  }),
  /** Frontier + research + custom OpenAI-compatible routing */
  ai: z.object({
    activeProvider: aiProviderIdSchema,
    streamSummaries: z.boolean(),
    naturalLanguage: z.boolean(),
    providers: z.object({
      claude: aiProviderStateSchema,
      openai: aiProviderStateSchema,
      gemini: aiProviderStateSchema,
      grok: aiProviderStateSchema,
      perplexity: aiProviderStateSchema,
      ollama: aiProviderStateSchema,
      custom: aiProviderStateSchema,
    }),
    /**
     * OpenAI-compatible custom endpoint (OpenRouter, Moonshot, Z.ai, local vLLM, …).
     * Used when activeProvider === 'custom'. Model examples: z-ai/glm-5.2, moonshotai/kimi-k2.7-code
     */
    custom: z
      .object({
        baseUrl: z.string().default('https://openrouter.ai/api/v1'),
        modelId: z.string().default('z-ai/glm-5.2'),
        label: z.string().optional(),
      })
      .default({
        baseUrl: 'https://openrouter.ai/api/v1',
        modelId: 'z-ai/glm-5.2',
      }),
    /** Local Ollama on Mac — OpenAI-compatible /v1 */
    ollama: z
      .object({
        baseUrl: z.string().default(OLLAMA_DEFAULT_BASE_URL),
        modelId: z.string().default('llama3.2:latest'),
      })
      .default({
        baseUrl: OLLAMA_DEFAULT_BASE_URL,
        modelId: 'llama3.2:latest',
      }),
  }),
  integrations: z.object({
    allowConnectOtherApps: z.boolean(),
    clickup: z.object({
      connected: z.boolean(),
      workspaceId: z.string().optional(),
      label: z.string().optional(),
    }),
    attio: z.object({
      connected: z.boolean(),
      workspaceId: z.string().optional(),
      label: z.string().optional(),
    }),
    github: z.object({
      connected: z.boolean(),
    }),
    google: z.object({
      connected: z.boolean(),
    }),
  }),
  privacy: z.object({
    discoverability: discoverabilitySchema,
    contactSharing: contactSharingSchema,
    blockedInviteIds: z.array(z.string()),
  }),
})

export type BevelUserPreferences = z.infer<typeof bevelUserPreferencesSchema>
export type BevelProfile = BevelUserPreferences['profile']
export type ProfileAttribute = BevelProfile['attributes'][number]
export type NotifyOn = z.infer<typeof notifyOnSchema>
export type PermissionState = z.infer<typeof permissionStateSchema>

/** Suggested attribute keys — operators can still type freeform names. */
export const PROFILE_ATTRIBUTE_SUGGESTIONS = [
  'Languages',
  'Timezone',
  'On-call',
  'Primary stack',
  'Tools',
  'Working hours',
  'Decision rights',
  'Preferred contact',
  'Domains owned',
  'Seniority',
] as const

/** Suggested capability tags for the chip input. */
export const PROFILE_TAG_SUGGESTIONS = [
  'typescript',
  'python',
  'product',
  'design',
  'devops',
  'on-call',
  'frontend',
  'backend',
  'ai',
  'sales',
  'support',
  'leadership',
] as const

/**
 * Compact plain-text brief for agents / system prompts.
 * Prefer structured fields; fall back to empty string when thin.
 */
export function formatProfileForAgents(profile: BevelProfile): string {
  const lines: string[] = []
  const name = profile.displayName?.trim() || profile.handle?.trim()
  if (name) {
    const handle = profile.handle?.trim()
      ? ` (@${profile.handle.replace(/^@/, '')})`
      : ''
    lines.push(`Name: ${name}${handle}`)
  }
  if (profile.pronouns?.trim()) lines.push(`Pronouns: ${profile.pronouns.trim()}`)
  if (profile.jobTitle?.trim() || profile.org?.trim()) {
    lines.push(
      `Role: ${[profile.jobTitle?.trim(), profile.org?.trim()].filter(Boolean).join(' · ')}`,
    )
  }
  if (profile.timezone?.trim()) lines.push(`Timezone: ${profile.timezone.trim()}`)
  if (profile.location?.trim()) lines.push(`Location: ${profile.location.trim()}`)
  if (profile.tags?.length) {
    lines.push(`Tags: ${profile.tags.map((t) => t.trim()).filter(Boolean).join(', ')}`)
  }
  if (profile.description?.trim()) {
    lines.push(`Description: ${profile.description.trim()}`)
  } else if (profile.bio?.trim()) {
    lines.push(`Bio: ${profile.bio.trim()}`)
  }
  for (const a of profile.attributes ?? []) {
    const k = a.key?.trim()
    const v = a.value?.trim()
    if (k && v) lines.push(`${k}: ${v}`)
  }
  return lines.join('\n')
}

export const AI_PROVIDER_META: Record<
  AiProviderId,
  { name: string; shortName: string; keyHint: string; description: string }
> = {
  claude: {
    name: 'Anthropic Claude',
    shortName: 'Claude',
    keyHint: 'sk-ant-...',
    description: 'Default reasoning path for agents and channel ops.',
  },
  openai: {
    name: 'OpenAI',
    shortName: 'OpenAI',
    keyHint: 'sk-proj-...',
    description: 'Fast coding, structured output, and tool planning.',
  },
  gemini: {
    name: 'Google Gemini',
    shortName: 'Gemini',
    keyHint: 'AIza...',
    description: 'Google model access for broad context workflows.',
  },
  grok: {
    name: 'xAI Grok',
    shortName: 'Grok',
    keyHint: 'xai-...',
    description: 'xAI-compatible model routing.',
  },
  perplexity: {
    name: 'Perplexity',
    shortName: 'Perplexity',
    keyHint: 'pplx-...',
    description: 'Web-grounded Sonar models for research and grounded answers.',
  },
  ollama: {
    name: 'Ollama (Mac)',
    shortName: 'Ollama',
    keyHint: 'optional (local)',
    description:
      'Local models via Ollama on this Mac — no cloud key required.',
  },
  custom: {
    name: 'Custom model',
    shortName: 'Custom',
    keyHint: 'sk-or-… / provider key',
    description:
      'OpenAI-compatible endpoint — GLM-5.2, Kimi K2.7 Code, OpenRouter, remote Ollama.',
  },
}

/** One-click presets for the custom OpenAI-compatible provider. */
export const CUSTOM_MODEL_PRESETS = [
  {
    id: 'ollama-local',
    label: 'Ollama Mac',
    baseUrl: OLLAMA_DEFAULT_BASE_URL,
    modelId: 'llama3.2:latest',
    hint: 'Local http://127.0.0.1:11434/v1',
  },
  {
    id: 'glm-5.2',
    label: 'GLM-5.2',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelId: 'z-ai/glm-5.2',
    hint: 'Z.ai via OpenRouter',
  },
  {
    id: 'kimi-k2.7-code',
    label: 'Kimi K2.7 Code',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelId: 'moonshotai/kimi-k2.7-code',
    hint: 'Moonshot via OpenRouter',
  },
  {
    id: 'openrouter-auto',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelId: 'openrouter/auto',
    hint: 'Router picks a strong model',
  },
] as const

/** Suggested local tags when Ollama discovery is offline. */
export const OLLAMA_MODEL_SUGGESTIONS = [
  'llama3.2:latest',
  'gemma4:latest',
  'qwen2.5-coder:32b',
  'codestral:22b',
  'deepseek-coder:33b',
  'deepseek-r1:32b',
  'kimi-k2-thinking:cloud',
  'gpt-oss:20b',
] as const

export const SOCIAL_META: Record<
  SocialNetworkId,
  {
    label: string
    placeholder: string
    rel: string
    /** Hostnames accepted for this network (no www.). */
    hosts: string[]
    /** Base URL used when the user pastes a bare @handle. */
    handleBase: string
  }
> = {
  x: {
    label: 'X (Twitter)',
    placeholder: 'https://x.com/you',
    rel: 'me',
    hosts: ['x.com', 'twitter.com', 'mobile.twitter.com'],
    handleBase: 'https://x.com/',
  },
  instagram: {
    label: 'Instagram',
    placeholder: 'https://instagram.com/you',
    rel: 'me',
    hosts: ['instagram.com', 'www.instagram.com'],
    handleBase: 'https://instagram.com/',
  },
  tiktok: {
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@you',
    rel: 'me',
    hosts: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
    handleBase: 'https://tiktok.com/@',
  },
  youtube: {
    label: 'YouTube',
    placeholder: 'https://youtube.com/@you',
    rel: 'me',
    hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
    handleBase: 'https://youtube.com/@',
  },
}

export type SocialUrlValidation = {
  ok: boolean
  /** Normalized value to store (empty string or absolute https URL). */
  value: string
  /** User-facing error when ok is false. */
  error?: string
}

/**
 * Normalize a social field: trim, expand bare @handles, force https.
 * Does not reject wrong hosts — use validateSocialUrl for that.
 */
export function normalizeSocialInput(
  network: SocialNetworkId,
  raw: string,
): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const meta = SOCIAL_META[network]
  // Bare handle: @scott or scott (no scheme/slash)
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.includes('/') && !trimmed.includes('.')) {
    const handle = trimmed.replace(/^@+/, '')
    if (!handle) return ''
    return `${meta.handleBase}${handle}`
  }
  // Host without scheme
  if (!/^https?:\/\//i.test(trimmed) && /^[\w.-]+\.\w{2,}/i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, '')}`
  }
  // Upgrade http → https for public socials
  if (/^http:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://')
  }
  return trimmed
}

/** Validate a profile website / photo URL (empty allowed). */
export function validateHttpUrl(
  raw: string,
  label = 'URL',
): SocialUrlValidation {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: '' }
  let candidate = trimmed
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`
  }
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, value: trimmed, error: `${label} must be http(s).` }
    }
    if (u.protocol === 'http:') {
      u.protocol = 'https:'
    }
    return { ok: true, value: u.toString() }
  } catch {
    return {
      ok: false,
      value: trimmed,
      error: `Enter a full ${label.toLowerCase()} (https://…).`,
    }
  }
}

/**
 * Validate a social profile URL for the given network.
 * Empty is valid. Bare handles are expanded. Wrong network hosts fail.
 */
export function validateSocialUrl(
  network: SocialNetworkId,
  raw: string,
): SocialUrlValidation {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: '' }

  const normalized = normalizeSocialInput(network, trimmed)
  const meta = SOCIAL_META[network]

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    return {
      ok: false,
      value: trimmed,
      error: `Enter a full ${meta.label} URL or @handle.`,
    }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      ok: false,
      value: trimmed,
      error: `${meta.label} link must use https.`,
    }
  }
  if (url.protocol === 'http:') {
    url.protocol = 'https:'
  }

  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  const allowed = meta.hosts.map((h) => h.replace(/^www\./i, '').toLowerCase())
  const hostOk = allowed.some(
    (h) => host === h || host.endsWith(`.${h}`),
  )
  if (!hostOk) {
    return {
      ok: false,
      value: trimmed,
      error: `Use a ${meta.label} URL (${meta.hosts[0]}), not ${host}.`,
    }
  }

  // Require a path segment beyond bare domain (profile handle / channel)
  const path = url.pathname.replace(/\/+$/, '')
  if (!path || path === '') {
    return {
      ok: false,
      value: trimmed,
      error: `Add your ${meta.label} username or profile path.`,
    }
  }

  return { ok: true, value: url.toString() }
}

const emptyProvider = { enabled: true, configured: false, keyPreview: '' }

export const DEFAULT_PREFERENCES: BevelUserPreferences = {
  version: PREFERENCES_VERSION,
  availability: {
    workingHoursEnabled: true,
    days: 'every_day',
    start: '08:00',
    end: '22:00',
    autoInChannel: true,
    autoFocus: true,
    autoAfterHours: false,
  },
  notifications: {
    desktopEnabled: true,
    mobileEnabled: true,
    notifyOn: 'mentions_dms',
    threadReplies: true,
    vipBypassPaused: false,
    newHuddles: true,
    activity: {
      dms: true,
      allPostsChannels: true,
      reminders: true,
    },
    sms: {
      enabled: false,
      phoneE164: '',
      phoneVerified: false,
      graceMinutes: 5,
      onlyMentionsAndDms: true,
      includeVoteLinks: false,
      quietHoursEnabled: false,
      quietStart: '22:00',
      quietEnd: '07:00',
    },
  },
  vip: {
    alwaysNotify: false,
    unreadsSection: true,
    memberIds: [],
  },
  navigation: {
    tabs: {
      home: true,
      dms: true,
      activity: true,
      files: true,
      tools: false,
      ai: true,
    },
    tabAppearance: 'icons_and_text',
    showAgentsInTopBar: true,
  },
  home: {
    channelOrgTips: true,
    homeActivityDot: true,
    sidebarAlways: {
      unreads: false,
      huddles: true,
      threads: true,
      drafts: true,
      directories: true,
    },
    filter: 'active',
  },
  appearance: {
    themeId: 'tenant',
    density: 'clean',
    daypart: 'auto',
  },
  messages: {
    nameStyle: 'full_and_display',
    showTyping: true,
    showAvatars: true,
    clock24h: false,
    colorSwatches: true,
  },
  language: {
    locale: 'en-US',
    timezoneAuto: true,
    timezone: 'UTC',
    spellcheck: true,
  },
  accessibility: {
    simplifiedLayout: false,
    zoomPercent: 100,
    altTextReminders: false,
  },
  markAsRead: {
    onViewBehavior: 'resume_and_read',
    confirmMarkAll: true,
  },
  profile: {
    displayName: '',
    honorificPrefix: '',
    givenName: '',
    familyName: '',
    nickname: '',
    handle: '',
    bio: '',
    description: '',
    pronouns: '',
    timezone: '',
    url: '',
    emailPublic: false,
    org: '',
    jobTitle: '',
    location: '',
    photoUrl: '',
    tags: [],
    attributes: [],
    socials: {
      x: '',
      instagram: '',
      tiktok: '',
      youtube: '',
    },
  },
  account: {
    displayNameSource: 'google',
  },
  media: {
    cameraPermission: 'prompt',
    microphonePermission: 'prompt',
    autoGainControl: true,
    noiseSuppression: true,
    echoCancellation: true,
  },
  ai: {
    activeProvider: 'claude',
    streamSummaries: true,
    naturalLanguage: true,
    providers: {
      claude: { ...emptyProvider },
      openai: { ...emptyProvider },
      gemini: { ...emptyProvider },
      grok: { ...emptyProvider },
      perplexity: { ...emptyProvider },
      ollama: { ...emptyProvider },
      custom: { ...emptyProvider },
    },
    custom: {
      baseUrl: 'https://openrouter.ai/api/v1',
      modelId: 'z-ai/glm-5.2',
      label: 'GLM-5.2',
    },
    ollama: {
      baseUrl: OLLAMA_DEFAULT_BASE_URL,
      modelId: 'llama3.2:latest',
    },
  },
  integrations: {
    allowConnectOtherApps: true,
    clickup: { connected: false },
    attio: { connected: false },
    github: { connected: false },
    google: { connected: false },
  },
  privacy: {
    discoverability: 'email',
    contactSharing: 'workspace_only',
    blockedInviteIds: [],
  },
}

/** Deep-merge partial prefs onto defaults and validate. */
export function parsePreferences(input: unknown): BevelUserPreferences {
  const base = structuredClone(DEFAULT_PREFERENCES)
  if (!input || typeof input !== 'object') {
    return base
  }
  const merged = deepMerge(base, input as Record<string, unknown>)
  merged.version = PREFERENCES_VERSION
  const result = bevelUserPreferencesSchema.safeParse(merged)
  return result.success ? result.data : base
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target }
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      out[key] = deepMerge(
        target[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      )
    } else if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}
