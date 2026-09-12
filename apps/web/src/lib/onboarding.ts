import {
  BEVEL_HOME_PATH,
  BEVEL_PRIVATE_PATH,
  BEVEL_DEFAULT_PERSONAL_AGENT,
  bevelTalkPath,
} from './bevel'

export const ONBOARDING_STORAGE_KEY = 'bevel.onboarding.v1'

/** Canonical first-run destinations. Never concatenate `/general` onto `BEVEL_HOME_PATH`. */
export const ONBOARDING_HREFS = {
  privateHome: BEVEL_PRIVATE_PATH,
  hermes: bevelTalkPath(BEVEL_DEFAULT_PERSONAL_AGENT),
  channel: BEVEL_HOME_PATH,
  claim: '/claim',
  download: '/download',
  workspaces: '/workspaces',
  talk: '/talk',
  login: '/login?callbackUrl=%2Fwelcome',
} as const

export type OnboardingMode = 'private' | 'org'

export type OnboardingProgress = {
  invite?: boolean
  channel?: boolean
  hermes?: boolean
  privateDone?: boolean
  dismissed?: boolean
}

export function parseOnboardingProgress(raw: string | null): OnboardingProgress {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as OnboardingProgress
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function shouldShowFirstRun(
  progress: OnboardingProgress,
  mode: OnboardingMode,
): boolean {
  if (progress.dismissed) return false
  if (mode === 'private') return !progress.privateDone && !progress.hermes
  return !progress.channel
}
