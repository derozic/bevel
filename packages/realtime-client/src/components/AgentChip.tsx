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
  onToggle: () => void
}

type TipPosition = {
  top: number
  left: number
  placement: 'above' | 'below'
}

function clampTipLeft(left: number, width: number): number {
  const margin = 12
  const maxLeft = window.innerWidth - width - margin
  return Math.max(margin, Math.min(left, maxLeft))
}

export function AgentChip({ agent, active, onToggle }: AgentChipProps) {
  const stripe = accentStripeColor(agent.accent)
  const tipId = useId()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const [showTip, setShowTip] = useState(false)
  const [tipPos, setTipPos] = useState<TipPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  const copy = resolveAgentChipCopy(agent.id, {
    tagline: agent.tagline,
    summary: agent.summary,
    capabilities: agent.capabilities,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const positionTip = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const tipWidth = 248
    const left = clampTipLeft(rect.left + rect.width / 2 - tipWidth / 2, tipWidth)
    const spaceBelow = window.innerHeight - rect.bottom
    const placement: TipPosition['placement'] = spaceBelow < 168 ? 'above' : 'below'
    const top =
      placement === 'below' ? rect.bottom + 8 : Math.max(12, rect.top - 8)
    setTipPos({ top, left, placement })
  }, [])

  const openTip = useCallback(() => {
    if (!copy?.summary) return
    positionTip()
    setShowTip(true)
  }, [copy?.summary, positionTip])

  const closeTip = useCallback(() => {
    setShowTip(false)
  }, [])

  useEffect(() => {
    if (!showTip) return
    const onScrollOrResize = () => positionTip()
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [showTip, positionTip])

  const tip =
    mounted && showTip && copy && tipPos
      ? createPortal(
          <div
            id={tipId}
            role="tooltip"
            className="fleet-chat-chip-tip"
            data-placement={tipPos.placement}
            style={
              {
                '--chip-accent': stripe ?? 'var(--ink)',
                top: `${tipPos.top}px`,
                left: `${tipPos.left}px`,
              } as CSSProperties
            }
          >
            <p className="fleet-chat-chip-tip-tagline">{copy.tagline}</p>
            <p className="fleet-chat-chip-tip-summary">{copy.summary}</p>
            {copy.capabilities.length > 0 ? (
              <ul className="fleet-chat-chip-tip-caps">
                {copy.capabilities.map((cap) => (
                  <li key={cap}>{cap}</li>
                ))}
              </ul>
            ) : null}
          </div>,
          document.body
        )
      : null

  return (
    <>
      <span
        ref={wrapRef}
        className="fleet-chat-chip-wrap"
        onMouseEnter={openTip}
        onMouseLeave={closeTip}
      >
        <button
          type="button"
          onClick={onToggle}
          onFocus={openTip}
          onBlur={closeTip}
          aria-pressed={active}
          aria-describedby={showTip && copy ? tipId : undefined}
          data-active={active ? 'true' : 'false'}
          className="fleet-chat-chip"
          style={
            active && stripe
              ? ({ '--chip-accent': stripe } as CSSProperties)
              : undefined
          }
        >
          {agent.name}
        </button>
      </span>
      {tip}
    </>
  )
}