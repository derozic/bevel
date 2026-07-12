'use client'

import { useEffect, useMemo, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { FleetChat, FleetProvider, type FleetWorkRepo } from '@bevel/realtime-client'
import { agents } from '@/lib/agent-catalog'
import { BEVEL_ARCHIVE_PATH, BEVEL_COPY, bevelTalkPath } from '@/lib/bevel'
import { UserMenu } from '@/components/UserMenu'
import { usePreferencesOptional } from '@/components/preferences/PreferencesProvider'
import {
  ensureNotificationPermission,
  showBevelNotification,
} from '@/lib/bevel-notify'

const WORK_REPO_STORAGE_KEY = 'bevel.workRepo'

type WorkReposResponse = {
  repos: FleetWorkRepo[]
  defaultRepo: string
  canPutOnWork: boolean
}

type WorkAccessMeta = {
  githubEnabled: boolean
  linked: boolean
  login: string | null
}

function displayNameFromSession(
  session: ReturnType<typeof useSession>['data']
): string {
  const name = session?.user?.name
  if (name) return name
  const email = session?.user?.email
  if (email) return email.split('@')[0] ?? email
  return 'operator'
}

export function ChannelChatShell({
  roomMode = 'channel',
  channelSlug = 'general',
  sessionId,
  sessionTitle,
  initialAgents = ['hermes', 'johnny', 'terry', 'forge'],
  fillViewport = false,
  showChannelToggle = false,
  onChannelToggle,
  focusMessageId,
  highlightQuery,
}: {
  roomMode?: 'channel' | 'session'
  channelSlug?: string
  sessionId?: string
  sessionTitle?: string
  initialAgents?: string[]
  fillViewport?: boolean
  showChannelToggle?: boolean
  onChannelToggle?: () => void
  focusMessageId?: string
  highlightQuery?: string
}) {
  const { data: session, status } = useSession()
  const prefs = usePreferencesOptional()
  const [workRepos, setWorkRepos] = useState<FleetWorkRepo[]>([])
  const [defaultRepo, setDefaultRepo] = useState('derozic/2x4m')
  const [selectedWorkRepo, setSelectedWorkRepo] = useState<string | null>(null)
  const [canPutOnWork, setCanPutOnWork] = useState(
    () => Boolean(session?.canPutOnWork),
  )
  const [workMeta, setWorkMeta] = useState<WorkAccessMeta | null>(() =>
    session?.githubLogin
      ? {
          githubEnabled: true,
          linked: true,
          login: session.githubLogin,
        }
      : null,
  )

  useEffect(() => {
    if (status !== 'authenticated') {
      setWorkRepos([])
      setCanPutOnWork(false)
      setWorkMeta(null)
      return
    }

    // Optimistic from session while APIs load
    if (session?.githubLogin) {
      setWorkMeta({
        githubEnabled: true,
        linked: true,
        login: session.githubLogin,
      })
    }
    if (session?.canPutOnWork) setCanPutOnWork(true)

    let cancelled = false
    Promise.all([
      fetch('/api/github/work-repos', { credentials: 'include' }).then((res) =>
        res.ok ? res.json() : null
      ),
      fetch('/api/github/work-access', { credentials: 'include' }).then((res) =>
        res.ok ? res.json() : null
      ),
    ])
      .then(([reposData, accessData]) => {
        if (cancelled) return
        const reposPayload = reposData as WorkReposResponse | null
        if (reposPayload) {
          setWorkRepos(reposPayload.repos)
          setDefaultRepo(reposPayload.defaultRepo)
          setCanPutOnWork(reposPayload.canPutOnWork)
          const stored =
            typeof window !== 'undefined'
              ? window.localStorage.getItem(WORK_REPO_STORAGE_KEY)
              : null
          const writable = reposPayload.repos.filter((r) => r.canWrite)
          const pick =
            stored && writable.some((r) => r.fullName === stored)
              ? stored
              : reposPayload.defaultRepo
          setSelectedWorkRepo(pick)
        }
        if (accessData) {
          setWorkMeta({
            githubEnabled: Boolean(accessData.githubEnabled),
            linked: Boolean(accessData.linked),
            login: accessData.login ?? null,
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkRepos([])
          setCanPutOnWork(session?.canPutOnWork ?? false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [status, session?.canPutOnWork, session?.githubLogin])

  const fleetAgents = useMemo(
    () =>
      agents.map((a) => ({
        id: a.id,
        name: a.name,
        accent: a.accent,
        category: a.category,
        avatar: a.avatarUrl,
        tagline: a.tagline,
        summary: a.bio || a.summary,
        capabilities: a.skills.slice(0, 4),
      })),
    []
  )

  const resolvedCanPutOnWork = canPutOnWork || session?.canPutOnWork === true

  function handleWorkRepoChange(fullName: string) {
    setSelectedWorkRepo(fullName)
    try {
      window.localStorage.setItem(WORK_REPO_STORAGE_KEY, fullName)
    } catch {
      // ignore storage failures
    }
  }

  const realtimeUrl =
    process.env.NEXT_PUBLIC_REALTIME_URL ??
    process.env.REALTIME_URL ??
    'https://realtime.bevel.lvh.me'

  return (
    <FleetProvider
      realtimeUrl={realtimeUrl}
      realtimeToken={session?.realtimeToken}
      displayName={displayNameFromSession(session)}
      userId={session?.user?.id}
      avatarUrl={session?.user?.image ?? undefined}
      agents={fleetAgents}
      sessionsPath={BEVEL_ARCHIVE_PATH}
      authReady={status === 'authenticated' || status === 'unauthenticated'}
      roomMode={roomMode}
      channelSlug={channelSlug}
      sessionId={sessionId}
      sessionTitle={sessionTitle}
      showPoweredBy={false}
      canPutOnWork={resolvedCanPutOnWork}
      workRepo={selectedWorkRepo ?? defaultRepo}
      workRepos={workRepos}
      selectedWorkRepo={selectedWorkRepo ?? defaultRepo}
      onWorkRepoChange={handleWorkRepoChange}
      githubAuthEnabled={workMeta?.githubEnabled ?? false}
      githubLinked={workMeta?.linked ?? Boolean(session?.githubLogin)}
      githubLogin={workMeta?.login ?? session?.githubLogin ?? null}
      onLinkGitHub={() =>
        signIn('github', {
          callbackUrl: `/^product?github=linked&from=${encodeURIComponent(channelSlug)}`,
        })
      }
      authError={
        status !== 'loading' && !session?.realtimeToken
          ? BEVEL_COPY.auth.missingRealtimeToken
          : status !== 'loading' && !session
            ? BEVEL_COPY.auth.signInRequired
            : undefined
      }
    >
      <FleetChat
        initialAgents={initialAgents}
        fillViewport={fillViewport}
        showChannelToggle={showChannelToggle}
        focusMessageId={focusMessageId}
        highlightQuery={highlightQuery}
        onChannelToggle={onChannelToggle}
        userMenu={<UserMenu size="sm" align="end" />}
        agentMessageHref={(agentId) => bevelTalkPath(agentId)}
        showAvatars={prefs?.prefs.messages.showAvatars !== false}
        nameStyle={prefs?.prefs.messages.nameStyle ?? 'full_and_display'}
        clock24h={prefs?.prefs.messages.clock24h ?? false}
        onProgramMessage={(event) => {
          // Prefer desktop notifications when enabled in prefs
          if (prefs?.prefs.notifications.desktopEnabled === false) return
          const title = event.speaker || event.agentId || 'Agent'
          const body = event.body.slice(0, 240)
          void (async () => {
            await ensureNotificationPermission()
            await showBevelNotification({
              title,
              body,
              agentId: event.agentId,
              tag: `msg-${event.id}`,
              url: `/^${channelSlug}`,
              icon: '/icons/icon-192.png',
            })
          })()
        }}
      />
    </FleetProvider>
  )
}