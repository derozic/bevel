'use client'

import { Client, getStateCallbacks, type Room } from '@colyseus/sdk'
import { useSyncExternalStore } from 'react'
import { pinRealtimeEndpoint } from './realtime-client'

const EMPTY: ReadonlySet<string> = new Set()

let current: ReadonlySet<string> = EMPTY
let joinedUrl: string | null = null
let connectPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

function sameKeys(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  for (const key of a) if (!b.has(key)) return false
  return true
}

function publish(next: ReadonlySet<string>) {
  if (sameKeys(current, next)) return
  current = next.size === 0 ? EMPTY : next
  for (const listener of listeners) listener()
}

function readKeys(state: { workingKeys?: { length: number; [index: number]: string } }): ReadonlySet<string> {
  const list = state.workingKeys
  if (!list || list.length === 0) return EMPTY
  const next = new Set<string>()
  for (let i = 0; i < list.length; i++) {
    const key = list[i]
    if (key) next.add(key)
  }
  return next
}

function ensureLobby(realtimeUrl: string) {
  if (!realtimeUrl || joinedUrl === realtimeUrl || connectPromise) return
  connectPromise = (async () => {
    const client = new Client(realtimeUrl, {
      fetchFn: (input, init) => fetch(input, { ...init, credentials: 'omit' }),
      urlBuilder: (url) => pinRealtimeEndpoint(realtimeUrl, url),
    })
    let room: Room
    try {
      room = await client.joinOrCreate('fleet_lobby')
    } catch {
      connectPromise = null
      if (listeners.size > 0) {
        window.setTimeout(() => ensureLobby(realtimeUrl), 5000)
      }
      return
    }
    if (listeners.size === 0) {
      connectPromise = null
      room.leave()
      return
    }
    joinedUrl = realtimeUrl
    connectPromise = null
    const sync = () => publish(readKeys(room.state as { workingKeys?: { length: number; [index: number]: string } }))
    sync()
    try {
      const $ = getStateCallbacks(room)
      const keys = (room.state as { workingKeys?: { onAdd?: unknown } }).workingKeys
      if (keys) {
        $(room.state).workingKeys.onAdd(sync)
        $(room.state).workingKeys.onRemove(sync)
      }
    } catch {
      room.onStateChange(sync)
    }
    room.onStateChange(sync)
    room.onLeave(() => {
      if (joinedUrl === realtimeUrl) joinedUrl = null
      publish(EMPTY)
      if (listeners.size > 0) window.setTimeout(() => ensureLobby(realtimeUrl), 2000)
    })
  })()
}

function subscribe(realtimeUrl: string, onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  ensureLobby(realtimeUrl)
  return () => {
    listeners.delete(onStoreChange)
  }
}

/** Conversations with a live agent turn, mirrored from the fleet lobby. */
export function useWorkingKeys(realtimeUrl: string): ReadonlySet<string> {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(realtimeUrl, onStoreChange),
    () => current,
    () => EMPTY,
  )
}
