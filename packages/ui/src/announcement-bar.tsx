'use client'

import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { cn } from './utils'
import { AnnouncementIcon } from './announcement-icons'

export type AnnouncementBarStop = {
  color: string
  p3?: string
  at?: number
}

export type AnnouncementBarStyle = {
  textColor?: string
  linkColor?: string
  ctaBg?: string
  ctaText?: string
  ctaBorder?: string
  iconBg?: string
  iconColor?: string
  gradient: {
    angleDeg?: number
    stops: AnnouncementBarStop[]
  }
}

function gradientLayers(style: AnnouncementBarStyle): {
  srgb: string
  p3: string
} {
  const angle = style.gradient.angleDeg ?? 90
  const srgbStops = style.gradient.stops
    .map((s) => {
      const pos = s.at != null ? ` ${s.at}%` : ''
      return `${s.color}${pos}`
    })
    .join(', ')
  const p3Stops = style.gradient.stops
    .map((s) => {
      const pos = s.at != null ? ` ${s.at}%` : ''
      const col = s.p3 ? `color(display-p3 ${s.p3})` : s.color
      return `${col}${pos}`
    })
    .join(', ')
  return {
    srgb: `linear-gradient(${angle}deg, ${srgbStops})`,
    p3: `linear-gradient(${angle}deg, ${p3Stops})`,
  }
}

export function AnnouncementBar({
  title,
  body,
  icon,
  linkLabel = 'Learn more',
  linkHref,
  linkKind = 'app',
  ctaVariant = 'link',
  dismissible = true,
  onDismiss,
  style,
  className,
  leading,
  tone,
}: {
  title?: string
  body: string
  /** Heroicon id, e.g. device-phone-mobile */
  icon?: string
  linkLabel?: string
  linkHref: string
  linkKind?: 'app' | 'external'
  /** Inline underline link vs pill CTA button */
  ctaVariant?: 'link' | 'button'
  dismissible?: boolean
  onDismiss?: () => void
  style: AnnouncementBarStyle
  className?: string
  leading?: ReactNode
  /** Semantic role for day-part theming (promo = soft, action = alert) */
  tone?: 'promo' | 'action'
}) {
  const layers = useMemo(() => gradientLayers(style), [style])
  const text = style.textColor ?? '#1a1200'
  const linkColor = style.linkColor ?? text
  const external = linkKind === 'external' || /^https?:\/\//i.test(linkHref)
  const hasIcon = Boolean(leading || icon)
  const isButtonCta = ctaVariant === 'button'

  // Inline bg + CSS vars so daypart styles always beat the design-system
  // default (school-bus yellow). Vars alone can lose on HMR / cascade edge cases.
  const cssVars = {
    ['--announcement-bg' as string]: layers.srgb,
    ['--announcement-bg-p3' as string]: layers.p3,
    ['--announcement-fg' as string]: text,
    ['--announcement-link' as string]: linkColor,
    ['--announcement-cta-bg' as string]: style.ctaBg ?? '#ffffff',
    ['--announcement-cta-text' as string]: style.ctaText ?? text,
    ['--announcement-cta-border' as string]:
      style.ctaBorder ?? 'rgba(0,0,0,0.12)',
    ['--announcement-icon-bg' as string]: style.iconBg ?? 'rgba(0,0,0,0.08)',
    ['--announcement-icon-fg' as string]: style.iconColor ?? text,
    backgroundImage: layers.srgb,
    color: text,
  } as CSSProperties

  const ctaProps = external
    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
    : {}

  return (
    <div
      role="region"
      aria-label="Announcement"
      data-tone={tone}
      className={cn(
        'bevel-announcement-bar',
        isButtonCta && 'bevel-announcement-bar--cta',
        hasIcon && 'bevel-announcement-bar--icon',
        tone && `bevel-announcement-bar--${tone}`,
        className,
      )}
      style={cssVars}
    >
      <div className="bevel-announcement-bar__inner">
        <div className="bevel-announcement-bar__main">
          {leading ? (
            <span className="bevel-announcement-bar__leading" aria-hidden>
              {leading}
            </span>
          ) : icon ? (
            <span className="bevel-announcement-bar__icon-badge" aria-hidden>
              <AnnouncementIcon
                id={icon}
                className="bevel-announcement-bar__icon"
              />
            </span>
          ) : null}

          <p className="bevel-announcement-bar__copy">
            {title ? (
              <strong className="bevel-announcement-bar__title">{title} </strong>
            ) : null}
            <span className="bevel-announcement-bar__body">{body}</span>
            {!isButtonCta && linkHref ? (
              <>
                {' '}
                <a
                  className="bevel-announcement-bar__link"
                  href={linkHref}
                  {...ctaProps}
                >
                  {linkLabel}
                </a>
              </>
            ) : null}
          </p>
        </div>

        <div className="bevel-announcement-bar__actions">
          {isButtonCta && linkHref ? (
            <a
              className="bevel-announcement-bar__cta"
              href={linkHref}
              {...ctaProps}
            >
              {linkLabel}
            </a>
          ) : null}
          {dismissible ? (
            <button
              type="button"
              className="bevel-announcement-bar__dismiss"
              aria-label="Dismiss announcement"
              onClick={onDismiss}
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="bevel-announcement-bar__dismiss-icon"
                aria-hidden
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
