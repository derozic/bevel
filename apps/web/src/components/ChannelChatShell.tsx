'use client'

import { useEffect, useMemo, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { FleetChat, FleetProvider, type FleetWorkRepo } from '@bevel/realtime-client'
import { agents } from '@/lib/agent-catalog'
import { BEVEL_ARCHIVE_PATH, BEVEL_COPY } from '@/lib/bevel'

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
}: {
  roomMode?: 'channel' | 'session'
  channelSlug?: string
  sessionId?: string
  sessionTitle?: string
  initialAgents?: string[]
  fillViewport?: boolean
  showChannelToggle?: boolean
  onChannelToggle?: () => void
}) {
  const { data: session, status } = useSession()
  const [workRepos, setWorkRepos] = useState<FleetWorkRepo[]>([])
  const [defaultRepo, setDefaultRepo] = useState('derozic/2x4m')
  const [selectedWorkRepo, setSelectedWorkRepo] = useState<string | null>(null)
  const [canPutOnWork, setCanPutOnWork] = useState(false)
  const [workMeta, setWorkMeta] = useState<WorkAccessMeta | null>(null)

  useEffect(() => {
    if (status !== 'authenticated') {
      setWorkRepos([])
      setCanPutOnWork(false)
      setWorkMeta(null)
      return
    }

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
        summary: a.bio,
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

  return (
    <FleetProvider
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
        signIn('github', { callbackUrl: `/bevel/${channelSlug}` })
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
        onChannelToggle={onChannelToggle}
      />
    </FleetProvider>
  )
}