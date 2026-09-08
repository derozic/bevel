'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArchiveBoxIcon,
  CheckIcon,
  EllipsisHorizontalIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  HeartIcon,
  LinkIcon,
  StarIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  HandThumbDownIcon as HandThumbDownSolid,
  HandThumbUpIcon as HandThumbUpSolid,
  HeartIcon as HeartSolid,
  StarIcon as StarSolid,
} from '@heroicons/react/24/solid'
import {
  applyGesture,
  gestureCounts,
  stripVoteMarker,
  userGestureKinds,
  type GestureKind,
} from '@bevel/schema'
import type { ChatMsg } from '../lib/colyseus-messages'
import { notifyNativeGesture } from '../lib/bubble-gestures'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

const SIGNALS: Array<{
  kind: GestureKind
  label: string
  Outline: typeof HandThumbUpIcon
  Solid: typeof HandThumbUpSolid
}> = [
  { kind: 'up', label: 'Thumbs up', Outline: HandThumbUpIcon, Solid: HandThumbUpSolid },
  { kind: 'down', label: 'Thumbs down', Outline: HandThumbDownIcon, Solid: HandThumbDownSolid },
  { kind: 'star', label: 'Star', Outline: StarIcon, Solid: StarSolid },
  { kind: 'heart', label: 'Heart', Outline: HeartIcon, Solid: HeartSolid },
]

export function displayMessageBody(m: ChatMsg): string {
  return stripVoteMarker(m.body)
}

const BURST_ICONS: Record<
  GestureKind,
  typeof HandThumbUpSolid
> = {
  up: HandThumbUpSolid,
  down: HandThumbDownSolid,
  star: StarSolid,
  heart: HeartSolid,
  vote_yes: CheckIcon,
  vote_no: XMarkIcon,
}

/** Floating confirm that plays on the bubble after a signal. */
export function GestureBurstMark({ kind }: { kind: GestureKind }) {
  const Icon = BURST_ICONS[kind] ?? HeartSolid
  return (
    <span className="fleet-chat-burst" data-kind={kind} aria-hidden>
      <span className="fleet-chat-burst-ring" />
      <span className="fleet-chat-burst-ring fleet-chat-burst-ring--late" />
      <Icon className="fleet-chat-burst-icon" />
    </span>
  )
}

function GestureButton({
  kind,
  label,
  Outline,
  Solid,
  active,
  count,
  onPick,
}: {
  kind: GestureKind
  label: string
  Outline: typeof HandThumbUpIcon
  Solid: typeof HandThumbUpSolid
  active: boolean
  count: number
  onPick: (kind: GestureKind) => void
}) {
  const Icon = active ? Solid : Outline
  const [pop, setPop] = useState(false)
  return (
    <button
      type="button"
      className="fleet-chat-gesture"
      data-kind={kind}
      data-active={active ? 'true' : 'false'}
      data-pop={pop ? 'true' : undefined}
      aria-pressed={active}
      aria-label={count ? `${label}, ${count}` : label}
      onClick={() => {
        setPop(true)
        window.setTimeout(() => setPop(false), 420)
        onPick(kind)
      }}
    >
      <Icon className="fleet-chat-gesture-icon" />
      {count > 0 ? <span className="fleet-chat-gesture-count">{count}</span> : null}
    </button>
  )
}

export function MessageGestures({
  message,
  selfId,
  incoming,
  onToggle,
}: {
  message: ChatMsg
  selfId: string
  incoming: boolean
  dockOpen?: boolean
  onToggle: (kind: GestureKind) => void
  onCloseDock?: () => void
}) {
  const gestures = message.reactions ?? []
  const counts = gestureCounts(gestures)
  const mine = userGestureKinds(gestures, selfId)
  const votePrompt = message.votePrompt?.trim()
  const chips = SIGNALS.filter((s) => counts[s.kind] > 0)

  const pick = (kind: GestureKind) => {
    notifyNativeGesture(kind)
    onToggle(kind)
    try {
      window.localStorage.setItem('bevel.gesture.hint', '1')
    } catch {
      /* ignore */
    }
  }

  if (message.status === 'pending' || message.status === 'streaming') {
    return null
  }
  if (!votePrompt && chips.length === 0) return null

  return (
    <div
      className="fleet-chat-gestures"
      data-incoming={incoming ? 'true' : 'false'}
    >
      {votePrompt ? (
        <div className="fleet-chat-vote" role="group" aria-label="Vote">
          <p className="fleet-chat-vote-prompt">{votePrompt}</p>
          <div className="fleet-chat-vote-row">
            <button
              type="button"
              className="fleet-chat-gesture fleet-chat-gesture--vote"
              data-active={mine.has('vote_yes') ? 'true' : 'false'}
              aria-pressed={mine.has('vote_yes')}
              aria-label={`Yes${counts.vote_yes ? ` ${counts.vote_yes}` : ''}`}
              onClick={() => pick('vote_yes')}
            >
              <CheckIcon className="fleet-chat-gesture-icon" />
              <span>Yes</span>
              {counts.vote_yes > 0 ? <span>{counts.vote_yes}</span> : null}
            </button>
            <button
              type="button"
              className="fleet-chat-gesture fleet-chat-gesture--vote"
              data-active={mine.has('vote_no') ? 'true' : 'false'}
              aria-pressed={mine.has('vote_no')}
              aria-label={`No${counts.vote_no ? ` ${counts.vote_no}` : ''}`}
              onClick={() => pick('vote_no')}
            >
              <XMarkIcon className="fleet-chat-gesture-icon" />
              <span>No</span>
              {counts.vote_no > 0 ? <span>{counts.vote_no}</span> : null}
            </button>
          </div>
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="fleet-chat-gesture-row" role="group" aria-label="Message reactions">
          {chips.map((s) => (
            <GestureButton
              key={s.kind}
              {...s}
              active={mine.has(s.kind)}
              count={counts[s.kind]}
              onPick={pick}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Slack-sized hover/tap bar: icon reactions plus an ellipsis for archive/delete. */
export function GestureThumbTray({
  message,
  selfId,
  burst,
  permalink,
  onToggle,
  onArchive,
  onDelete,
}: {
  message: ChatMsg
  selfId: string
  speaker?: string
  burst?: GestureKind | null
  permalink?: string
  onToggle: (kind: GestureKind) => void
  onClose?: () => void
  onArchive?: () => void
  onDelete?: () => void
}) {
  const gestures = message.reactions ?? []
  const counts = gestureCounts(gestures)
  const mine = userGestureKinds(gestures, selfId)
  const votePrompt = message.votePrompt?.trim()
  const [popKind, setPopKind] = useState<GestureKind | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const copiedTimer = useRef<number | null>(null)

  const copyLink = useCallback(async () => {
    if (!permalink) return
    const absolute = permalink.startsWith('http')
      ? permalink
      : permalink.startsWith('?')
        ? `${window.location.origin}${window.location.pathname}${permalink}`
        : `${window.location.origin}${permalink}`
    const ok = await copyText(absolute)
    if (!ok) return
    setCopied(true)
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => {
      setCopied(false)
      setMoreOpen(false)
    }, 900)
  }, [permalink])

  useEffect(() => {
    if (!moreOpen) {
      setCopied(false)
      return
    }
    const onDoc = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && moreRef.current?.contains(target)) return
      setMoreOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Escape') {
        event.preventDefault()
        setMoreOpen(false)
        return
      }
      if ((event.key === 'l' || event.key === 'L') && permalink) {
        event.preventDefault()
        event.stopPropagation()
        void copyLink()
      }
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [moreOpen, permalink, copyLink])

  useEffect(
    () => () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
    },
    [],
  )

  const pick = (kind: GestureKind) => {
    notifyNativeGesture(kind)
    setPopKind(kind)
    window.setTimeout(() => setPopKind((cur) => (cur === kind ? null : cur)), 480)
    onToggle(kind)
    setMoreOpen(false)
    try {
      window.localStorage.setItem('bevel.gesture.hint', '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="fleet-chat-action-bar"
      role="toolbar"
      aria-label="Message actions"
      data-open={moreOpen ? 'true' : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {votePrompt ? (
        <div className="fleet-chat-action-votes" role="group" aria-label="Vote">
          <button
            type="button"
            className="fleet-chat-action-btn"
            data-active={mine.has('vote_yes') ? 'true' : 'false'}
            aria-label="Yes"
            onClick={() => pick('vote_yes')}
          >
            <CheckIcon className="fleet-chat-action-icon" />
          </button>
          <button
            type="button"
            className="fleet-chat-action-btn"
            data-active={mine.has('vote_no') ? 'true' : 'false'}
            aria-label="No"
            onClick={() => pick('vote_no')}
          >
            <XMarkIcon className="fleet-chat-action-icon" />
          </button>
        </div>
      ) : null}
      {SIGNALS.map(({ kind, label, Outline, Solid }) => {
        const active = mine.has(kind)
        const Icon = active ? Solid : Outline
        const count = counts[kind]
        return (
          <button
            key={kind}
            type="button"
            className="fleet-chat-action-btn"
            data-kind={kind}
            data-active={active ? 'true' : 'false'}
            data-pop={popKind === kind || burst === kind ? 'true' : undefined}
            aria-pressed={active}
            aria-label={count ? `${label}, ${count}` : label}
            onClick={() => pick(kind)}
          >
            <Icon className="fleet-chat-action-icon" />
          </button>
        )
      })}
      <span className="fleet-chat-action-sep" aria-hidden />
      <div className="fleet-chat-action-more" ref={moreRef}>
        <button
          type="button"
          className="fleet-chat-action-btn"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <EllipsisHorizontalIcon className="fleet-chat-action-icon" />
        </button>
        {moreOpen ? (
          <div className="fleet-chat-action-menu" role="menu">
            {permalink ? (
              <button
                type="button"
                role="menuitem"
                className="fleet-chat-action-menu-item"
                onClick={() => {
                  void copyLink()
                }}
              >
                <span className="fleet-chat-action-menu-main">
                  {copied ? (
                    <CheckIcon className="fleet-chat-action-icon" />
                  ) : (
                    <LinkIcon className="fleet-chat-action-icon" />
                  )}
                  {copied ? 'Copied' : 'Copy link'}
                </span>
                {copied ? null : (
                  <span className="fleet-chat-action-menu-kbd">L</span>
                )}
              </button>
            ) : null}
            {onArchive ? (
              <button
                type="button"
                role="menuitem"
                className="fleet-chat-action-menu-item"
                onClick={() => {
                  setMoreOpen(false)
                  onArchive()
                }}
              >
                <span className="fleet-chat-action-menu-main">
                  <ArchiveBoxIcon className="fleet-chat-action-icon" />
                  Archive
                </span>
              </button>
            ) : null}
            {onDelete ? (
              <>
                <span className="fleet-chat-action-menu-sep" aria-hidden />
                <button
                  type="button"
                  role="menuitem"
                  className="fleet-chat-action-menu-item fleet-chat-action-menu-item--danger"
                  onClick={() => {
                    setMoreOpen(false)
                    onDelete()
                  }}
                >
                  <span className="fleet-chat-action-menu-main">
                    <TrashIcon className="fleet-chat-action-icon" />
                    Delete message
                  </span>
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Optimistic local apply used by FleetChat before the room echoes. */
export function optimisticGesture(
  message: ChatMsg,
  kind: GestureKind,
  userId: string,
  userName: string,
): ChatMsg {
  return {
    ...message,
    reactions: applyGesture(message.reactions ?? [], {
      kind,
      userId,
      userName,
    }),
  }
}
