'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { BEVEL_POWERED_BY_LABEL } from './product/bevel'
import { resolveRealtimeUrl } from './lib/realtime-client'
import type { FleetAgent } from './types'

export type FleetRoomMode = 'channel' | 'session'

export type FleetWorkRepo = {
  fullName: string
  default?: boolean
  canWrite: boolean
}

export type FleetContextValue = {
  realtimeUrl: string
  realtimeToken?: string
  displayName: string
  userId?: string
  avatarUrl?: string
  agents: FleetAgent[]
  sessionsPath: string
  authReady: boolean
  authError?: string
  roomMode: FleetRoomMode
  channelSlug?: string
  /** Resume or create a specific agent_session (filterBy sessionId on realtime). */
  sessionId?: string
  sessionTitle?: string
  /** Product attribution — defaults to "Powered by BEVEL" */
  poweredByLabel: string
  showPoweredBy: boolean
  /** User can dispatch agents against configured work repos (admin / GitHub write). */
  canPutOnWork?: boolean
  workRepo?: string
  workRepos?: FleetWorkRepo[]
  selectedWorkRepo?: string
  onWorkRepoChange?: (fullName: string) => void
  githubAuthEnabled?: boolean
  githubLinked?: boolean
  githubLogin?: string | null
  onLinkGitHub?: () => void
  ticketApiPath?: string
}

const FleetContext = createContext<FleetContextValue | null>(null)

export function FleetProvider({
  children,
  realtimeUrl,
  realtimeToken,
  displayName = 'operator',
  userId,
  avatarUrl,
  agents = [],
  sessionsPath = '/sessions',
  authReady = true,
  authError,
  roomMode = 'channel',
  channelSlug = 'general',
  sessionId,
  sessionTitle,
  poweredByLabel = BEVEL_POWERED_BY_LABEL,
  showPoweredBy = true,
  canPutOnWork = false,
  workRepo,
  workRepos = [],
  selectedWorkRepo,
  onWorkRepoChange,
  githubAuthEnabled = false,
  githubLinked = false,
  githubLogin,
  onLinkGitHub,
  ticketApiPath = '/api/github/tickets',
}: {
  children: ReactNode
  realtimeUrl?: string
  realtimeToken?: string
  displayName?: string
  userId?: string
  avatarUrl?: string
  agents?: FleetAgent[]
  sessionsPath?: string
  authReady?: boolean
  authError?: string
  roomMode?: FleetRoomMode
  channelSlug?: string
  sessionId?: string
  sessionTitle?: string
  poweredByLabel?: string
  showPoweredBy?: boolean
  canPutOnWork?: boolean
  workRepo?: string
  workRepos?: FleetWorkRepo[]
  selectedWorkRepo?: string
  onWorkRepoChange?: (fullName: string) => void
  githubAuthEnabled?: boolean
  githubLinked?: boolean
  githubLogin?: string | null
  onLinkGitHub?: () => void
  ticketApiPath?: string
}) {
  const resolvedRealtimeUrl = useMemo(
    () => realtimeUrl ?? resolveRealtimeUrl(),
    [realtimeUrl]
  )
  const value = useMemo<FleetContextValue>(
    () => ({
      realtimeUrl: resolvedRealtimeUrl,
      realtimeToken,
      displayName,
      userId,
      avatarUrl,
      agents,
      sessionsPath,
      authReady,
      authError,
      roomMode,
      channelSlug,
      sessionId,
      sessionTitle,
      poweredByLabel,
      showPoweredBy,
      canPutOnWork,
      workRepo,
      workRepos,
      selectedWorkRepo: selectedWorkRepo ?? workRepo,
      onWorkRepoChange,
      githubAuthEnabled,
      githubLinked,
      githubLogin,
      onLinkGitHub,
      ticketApiPath,
    }),
    [
      resolvedRealtimeUrl,
      realtimeToken,
      displayName,
      userId,
      avatarUrl,
      agents,
      sessionsPath,
      authReady,
      authError,
      roomMode,
      channelSlug,
      sessionId,
      sessionTitle,
      poweredByLabel,
      showPoweredBy,
      canPutOnWork,
      workRepo,
      workRepos,
      selectedWorkRepo,
      onWorkRepoChange,
      githubAuthEnabled,
      githubLinked,
      githubLogin,
      onLinkGitHub,
      ticketApiPath,
    ]
  )
  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
}

export function useFleet(): FleetContextValue {
  const ctx = useContext(FleetContext)
  if (!ctx) {
    throw new Error('useFleet must be used within FleetProvider')
  }
  return ctx
}

export function useFleetOptional(): FleetContextValue | null {
  return useContext(FleetContext)
}