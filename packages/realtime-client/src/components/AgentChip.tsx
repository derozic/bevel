'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { accentStripeColor } from '../lib/accent'
import { resolveAgentChipCopy } from '../product/agent-chip-copy'
import type { FleetAgent } from '../types'

export type AgentChipProps = {
  agent: FleetAgent
  active: boolean
  /** Toggle this agent in the current channel roster */
  onToggle: () => void
  /**
   * Direct-message URL (e.g. /brain/chat). When set, the profile card
   * exposes a primary Message action.
   */
  messageHref?: string
  /** Optional role line under the name */
  role?: string
  /**
   * Composer currently @mentions this agent — light up the chip and
   * surface that the mention resolved.
   */
  mentioned?: boolean
}

type CardPosition = {
  top: number
  left: number
  placement: 'above' | 'below'
}

function clampLeft(left: number, width: number): number {
  const margin = 12
  const maxLeft = window.innerWidth - width - margin
  return Math.max(margin, Math.min(left, maxLeft))
}

/**
 * Agent roster chip. Click opens a profile card (portal) with bio, skills,
 * Message (direct thread), and In-channel toggle. Hover still peeks the card.
 */
export function AgentChip({
  agent,
  active,
  onToggle,
  messageHref,
  role,
  mentioned = false,
}: AgentChipProps) {
  const stripe = accentStripeColor(agent.accent)
  const cardId = useId()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState<CardPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  const copy = resolveAgentChipCopy(agent.id, {
    tagline: agent.tagline,
    summary: agent.summary,
    capabilities: agent.capabilities,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const positionCard = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cardWidth = 288
    const left = clampLeft(rect.left + rect.width / 2 - cardWidth / 2, cardWidth)
    const spaceBelow = window.innerHeight - rect.bottom
    const placement: CardPosition['placement'] =
      spaceBelow < 260 ? 'above' : 'below'
    // When above, top is the anchor (chip top); CSS translateY(-100%) lifts the card.
    const top =
      placement === 'below' ? rect.bottom + 8 : Math.max(12, rect.top - 8)
    setPos((prev) => {
      if (
        prev &&
        prev.top === top &&
        prev.left === left &&
        prev.placement === placement
      ) {
        return prev
      }
      return { top, left, placement }
    })
  }, [])

  const openCard = useCallback(
    (asPinned: boolean) => {
      // Measure first, then open — avoids a one-frame unpositioned flash
      positionCard()
      setOpen(true)
      if (asPinned) setPinned(true)
    },
    [positionCard],
  )

  const closeCard = useCallback(() => {
    setOpen(false)
    setPinned(false)
  }, [])

  const scheduleClose = useCallback(() => {
    if (pinned) return
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => {
      setOpen(false)
    }, 160)
  }, [pinned])

  const cancelClose = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    // Reposition only on window resize — scroll re-measure was causing
    // focus/scroll-into-view feedback loops (visible as screen shake).
    const onResize = () => positionCard()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, positionCard])

  // Click outside to dismiss pinned card
  useEffect(() => {
    if (!open || !pinned) return
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (cardRef.current?.contains(t)) return
      closeCard()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCard()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, pinned, closeCard])

  const tagline = copy?.tagline ?? agent.tagline ?? agent.category ?? 'Agent'
  const summary = copy?.summary ?? agent.summary ?? ''
  const caps = copy?.capabilities?.length
    ? copy.capabilities
    : agent.capabilities ?? []
  const roleLine = role ?? agent.category

  const card =
    mounted && open && pos
      ? createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="dialog"
            aria-label={`${agent.name} profile`}
            className="fleet-chat-agent-card"
            data-placement={pos.placement}
            style={
              {
                '--chip-accent': stripe ?? 'var(--ink)',
                top: `${pos.top}px`,
                left: `${pos.left}px`,
              } as CSSProperties
            }
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div className="fleet-chat-agent-card__head">
              {agent.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agent.avatar}
                  alt=""
                  className="fleet-chat-agent-card__avatar"
                />
              ) : (
                <span
                  className="fleet-chat-agent-card__avatar fleet-chat-agent-card__avatar--fallback"
                  aria-hidden
                >
                  {agent.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="fleet-chat-agent-card__titles">
                <p className="fleet-chat-agent-card__name">{agent.name}</p>
                {roleLine ? (
                  <p className="fleet-chat-agent-card__role">{roleLine}</p>
                ) : null}
                <p className="fleet-chat-agent-card__tagline">{tagline}</p>
              </div>
            </div>

            {summary ? (
              <p className="fleet-chat-agent-card__summary">{summary}</p>
            ) : null}

            {caps.length > 0 ? (
              <ul className="fleet-chat-agent-card__caps">
                {caps.map((cap) => (
                  <li key={cap}>{cap}</li>
                ))}
              </ul>
            ) : null}

            <div className="fleet-chat-agent-card__actions">
              {messageHref ? (
                <a
                  href={messageHref}
                  className="fleet-chat-agent-card__btn fleet-chat-agent-card__btn--primary"
                >
                  Message
                </a>
              ) : null}
              <button
                type="button"
                className="fleet-chat-agent-card__btn"
                data-active={active ? 'true' : 'false'}
                aria-pressed={active}
                onClick={() => {
                  onToggle()
                }}
              >
                {active ? 'In channel' : 'Add to channel'}
              </button>
            </div>
            <p className="fleet-chat-agent-card__hint">
              Message starts a private direct thread. Channel keeps them in this
              room.
            </p>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <span
        ref={wrapRef}
        className="fleet-chat-chip-wrap"
        onMouseEnter={() => {
          cancelClose()
          if (!pinned) openCard(false)
        }}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          // preventDefault on mousedown stops the browser from scrolling the
          // focused chip into view inside the horizontal agents rail (jank).
          onMouseDown={(e) => {
            if (e.button !== 0) return
            e.preventDefault()
          }}
          onClick={(e) => {
            e.preventDefault()
            if (open && pinned) {
              closeCard()
            } else {
              openCard(true)
            }
            // Keep keyboard a11y without scrolling the page
            ;(e.currentTarget as HTMLButtonElement).focus({ preventScroll: true })
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? cardId : undefined}
          aria-pressed={active}
          data-active={active ? 'true' : 'false'}
          data-mentioned={mentioned ? 'true' : 'false'}
          className="fleet-chat-chip"
          style={
            (active || mentioned) && stripe
              ? ({ '--chip-accent': stripe } as CSSProperties)
              : undefined
          }
        >
          {agent.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.avatar}
              alt=""
              className="fleet-chat-chip-avatar"
              data-mentioned={mentioned ? 'true' : 'false'}
            />
          ) : (
            <span
              className="fleet-chat-chip-avatar fleet-chat-chip-avatar--fallback"
              data-mentioned={mentioned ? 'true' : 'false'}
              aria-hidden
            >
              {agent.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="fleet-chat-chip-label">{agent.name}</span>
        </button>
      </span>
      {card}
    </>
  )
}
