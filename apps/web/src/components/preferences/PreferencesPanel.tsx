'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  BellIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  EyeIcon,
  HomeIcon,
  LanguageIcon,
  LinkIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Squares2X2Icon,
  UserCircleIcon,
  UserGroupIcon,
  VideoCameraIcon,
  ChatBubbleLeftRightIcon,
  IdentificationIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@bevel/ui'
import { FeatureFlagsBar } from '@/components/FeatureFlagsBar'
import {
  usePreferences,
  type PreferencesSectionId,
} from './PreferencesProvider'

/** Read plan/access from <html data-*> set by root layout (no extra fetch). */
function FeatureFlagsBarFromDom({
  compact,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const [meta, setMeta] = useState<{ plan: string; access: string } | null>(
    null,
  )
  useEffect(() => {
    const root = document.documentElement
    setMeta({
      plan: root.dataset.tenantPlan ?? 'free',
      access: root.dataset.featureAccess ?? 'stable',
    })
  }, [])
  if (!meta) return null
  return (
    <FeatureFlagsBar
      compact={compact}
      plan={meta.plan}
      featureAccess={meta.access}
      className={className}
    />
  )
}

function SaveStatusLabel({ compact = false }: { compact?: boolean }) {
  const { saveStatus } = usePreferences()
  if (saveStatus === 'dirty') {
    return (
      <span
        className="inline-flex items-center gap-1 font-medium text-foreground"
        role="status"
      >
        <span className="size-1.5 rounded-full bg-accent" aria-hidden />
        {compact ? 'Unsaved' : 'Unsaved — click Save changes'}
      </span>
    )
  }
  if (saveStatus === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-muted" role="status">
        <span
          className="size-1.5 animate-pulse rounded-full bg-muted"
          aria-hidden
        />
        Saving to this browser…
      </span>
    )
  }
  if (saveStatus === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-accent" role="status">
        <CheckCircleIcon className="size-3.5" aria-hidden />
        {compact ? 'Saved' : 'Saved on this device'}
      </span>
    )
  }
  if (saveStatus === 'error') {
    return (
      <span className="font-medium text-danger" role="status">
        Couldn’t save — browser storage may be full or blocked
      </span>
    )
  }
  return (
    <span className="text-muted" role="status">
      {compact ? 'Local save' : 'All set on this device'}
    </span>
  )
}
import {
  AccessibilitySection,
  AccountSection,
  AiSection,
  AppearanceSection,
  AvailabilitySection,
  HomeSection,
  IntegrationsSection,
  LanguageSection,
  MarkAsReadSection,
  MediaSection,
  MessagesSection,
  NavigationSection,
  NotificationsSection,
  PrivacySection,
  ProfileSection,
  SecuritySection,
  VipSection,
} from './sections'
import { BEVEL_NAME } from '@/lib/bevel'

/** AI is primary (top). Profile next. Then product prefs. Integrations near bottom. */
const NAV: {
  id: PreferencesSectionId
  label: string
  icon: typeof BellIcon
  group?: 'primary' | 'product' | 'system'
}[] = [
  { id: 'ai', label: 'AI', icon: SparklesIcon, group: 'primary' },
  { id: 'profile', label: 'Profile', icon: IdentificationIcon, group: 'primary' },
  { id: 'account', label: 'Account', icon: UserCircleIcon, group: 'primary' },
  {
    id: 'availability',
    label: 'Availability',
    icon: CalendarDaysIcon,
    group: 'product',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: BellIcon,
    group: 'product',
  },
  { id: 'vip', label: 'Priority', icon: UserGroupIcon, group: 'product' },
  {
    id: 'navigation',
    label: 'Navigation',
    icon: Squares2X2Icon,
    group: 'product',
  },
  { id: 'home', label: 'Home', icon: HomeIcon, group: 'product' },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: PaintBrushIcon,
    group: 'product',
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: ChatBubbleLeftRightIcon,
    group: 'product',
  },
  {
    id: 'language',
    label: 'Language & region',
    icon: LanguageIcon,
    group: 'product',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    icon: ComputerDesktopIcon,
    group: 'product',
  },
  {
    id: 'markAsRead',
    label: 'Mark as read',
    icon: CheckCircleIcon,
    group: 'product',
  },
  {
    id: 'media',
    label: 'Audio & video',
    icon: VideoCameraIcon,
    group: 'product',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: LinkIcon,
    group: 'system',
  },
  { id: 'privacy', label: 'Privacy', icon: EyeIcon, group: 'system' },
  {
    id: 'security',
    label: 'Security',
    icon: ShieldCheckIcon,
    group: 'system',
  },
]

function sectionLabel(id: PreferencesSectionId): string {
  return NAV.find((n) => n.id === id)?.label ?? 'Preferences'
}

function SectionBody({ id }: { id: PreferencesSectionId }) {
  switch (id) {
    case 'ai':
      return <AiSection />
    case 'profile':
      return <ProfileSection />
    case 'account':
      return <AccountSection />
    case 'availability':
      return <AvailabilitySection />
    case 'notifications':
      return <NotificationsSection />
    case 'vip':
      return <VipSection />
    case 'navigation':
      return <NavigationSection />
    case 'home':
      return <HomeSection />
    case 'appearance':
      return <AppearanceSection />
    case 'messages':
      return <MessagesSection />
    case 'language':
      return <LanguageSection />
    case 'accessibility':
      return <AccessibilitySection />
    case 'markAsRead':
      return <MarkAsReadSection />
    case 'media':
      return <MediaSection />
    case 'integrations':
      return <IntegrationsSection />
    case 'privacy':
      return <PrivacySection />
    case 'security':
      return <SecuritySection />
    default:
      return null
  }
}

const easeOut = [0.22, 1, 0.36, 1] as const
const springPanel = { type: 'spring' as const, stiffness: 380, damping: 36, mass: 0.85 }

/**
 * Full-width sticky footer: clear save scope + primary CTA + ⌘S + autosave insurance.
 */
function PreferencesSaveFooter() {
  const { dirty, saveStatus, saveNow, lastSavedAt } = usePreferences()
  const busy = saveStatus === 'saving'
  const justSaved = saveStatus === 'saved' && !dirty
  const savedAgo =
    lastSavedAt && justSaved
      ? 'Just now'
      : lastSavedAt
        ? new Date(lastSavedAt).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })
        : null

  return (
    <footer
      className={cn(
        'shrink-0 border-t border-border bg-background/90 px-4 py-3.5 sm:px-5',
        'shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)]',
      )}
      aria-label="Save preferences"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            <SaveStatusLabel />
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Saves <strong className="font-medium text-foreground/90">profile, appearance, and settings</strong>{' '}
            in <strong className="font-medium text-foreground/90">this browser</strong> for{' '}
            <strong className="font-medium text-foreground/90">this workspace only</strong>
            {' '}— not to the server.
            {savedAgo ? (
              <span className="text-muted/90"> · Last saved {savedAgo}</span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted/90">
            Auto-saves after you pause typing ·{' '}
            <kbd className="rounded border border-border bg-surface px-1 font-mono text-[10px]">
              ⌘
            </kbd>
            <kbd className="ml-0.5 rounded border border-border bg-surface px-1 font-mono text-[10px]">
              S
            </kbd>{' '}
            anytime
          </p>
          <FeatureFlagsBarFromDom compact className="mt-1.5" />
        </div>
        <button
          type="button"
          onClick={() => saveNow()}
          disabled={busy}
          className={cn(
            'inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 sm:w-auto sm:min-w-[10.5rem]',
            'text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'disabled:pointer-events-none disabled:opacity-60',
            dirty || saveStatus === 'error'
              ? 'bg-accent text-white shadow-sm hover:opacity-90'
              : justSaved
                ? 'border border-accent/50 bg-accent/10 text-accent'
                : 'border border-border bg-surface text-foreground hover:border-accent/40 hover:bg-accent/10',
          )}
          aria-keyshortcuts="Meta+S Control+S"
        >
          {busy ? (
            'Saving…'
          ) : justSaved ? (
            <>
              <CheckCircleIcon className="size-4" aria-hidden />
              Saved
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </footer>
  )
}

/**
 * Right-edge preferences panel — slides in from the right with Framer Motion.
 * Section switches animate content; nav highlights the active section.
 * Opened via UserMenu, rail, Cmd+,, or /settings?section=.
 * Save: Update button, ⌘S, and debounced autosave as insurance.
 */
export function PreferencesPanel() {
  const { open, setOpen, section, openSection } = usePreferences()
  const reduceMotion = useReducedMotion()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const prevSectionRef = useRef(section)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const [sectionDir, setSectionDir] = useState(0)

  // Track nav direction for content slide (down list = +1, up = -1)
  useEffect(() => {
    if (prevSectionRef.current === section) return
    const prevIdx = NAV.findIndex((n) => n.id === prevSectionRef.current)
    const nextIdx = NAV.findIndex((n) => n.id === section)
    setSectionDir(nextIdx >= prevIdx ? 1 : -1)
    prevSectionRef.current = section
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' as ScrollBehavior : 'auto' })
  }, [section])

  // Body scroll lock + Escape + initial focus
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 40)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])

  const activeNav = NAV.find((n) => n.id === section)

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="bevel-prefs-root fixed inset-0 z-[120]"
          role="presentation"
        >
          {/* Scrim */}
          <motion.button
            type="button"
            aria-label="Close preferences"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            style={{ background: 'color-mix(in srgb, var(--ink, #0a0a0a) 38%, transparent)' }}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: easeOut }}
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'bevel-prefs-panel absolute inset-y-0 right-0 flex w-full max-w-[min(100vw,42rem)]',
              'flex-col border-l border-border bg-surface text-foreground shadow-2xl',
              'outline-none',
            )}
            initial={
              reduceMotion
                ? { opacity: 1, x: 0 }
                : { opacity: 0.96, x: '100%' }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0.98, x: '100%' }
            }
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : springPanel
            }
          >
            {/* Header */}
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <Cog6ToothIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
                  Preferences
                  <span className="hidden font-normal normal-case tracking-normal text-muted/80 sm:inline">
                    · {BEVEL_NAME}
                  </span>
                </div>
                <h2
                  id={titleId}
                  className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground"
                >
                  {sectionLabel(section)}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Browser storage · this workspace · use{' '}
                  <span className="font-medium text-foreground/80">Save changes</span>{' '}
                  below
                  <span className="mx-1.5 text-border" aria-hidden>
                    ·
                  </span>
                  <SaveStatusLabel compact />
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className="hidden items-center gap-0.5 text-[10px] text-muted sm:inline-flex"
                  title="Open preferences"
                >
                  <kbd className="rounded border border-border px-1 font-mono">⌘</kbd>
                  <kbd className="rounded border border-border px-1 font-mono">,</kbd>
                </span>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className={cn(
                    'inline-flex size-9 items-center justify-center rounded-full',
                    'border border-border bg-background/50 text-foreground transition',
                    'hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  )}
                  aria-label="Close preferences"
                >
                  <XMarkIcon className="size-5" aria-hidden />
                </button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1">
              {/* Section rail */}
              <nav
                className="hidden w-[11.5rem] shrink-0 overflow-y-auto border-r border-border bg-background/35 p-2 sm:block"
                aria-label="Preference sections"
              >
                {NAV.map((item, index) => {
                  const Icon = item.icon
                  const active = section === item.id
                  const prev = NAV[index - 1]
                  const showDivider =
                    prev &&
                    prev.group &&
                    item.group &&
                    prev.group !== item.group
                  return (
                    <div key={item.id}>
                      {showDivider ? (
                        <div
                          className="my-2 border-t border-border/80"
                          role="separator"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openSection(item.id)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition',
                          active
                            ? reduceMotion
                              ? 'bg-accent text-white shadow-sm'
                              : 'text-white'
                            : item.id === 'ai'
                              ? 'font-semibold text-foreground hover:bg-accent/10'
                              : 'text-muted hover:bg-accent/8 hover:text-foreground',
                        )}
                      >
                        {active && !reduceMotion ? (
                          <motion.span
                            layoutId="prefs-nav-pill"
                            className="absolute inset-0 rounded-lg bg-accent shadow-sm"
                            transition={springPanel}
                            aria-hidden
                          />
                        ) : null}
                        <Icon
                          className="relative z-[1] size-4 shrink-0 opacity-90"
                          aria-hidden
                        />
                        <span className="relative z-[1] truncate font-medium">
                          {item.label}
                        </span>
                        {item.id === 'ai' && !active ? (
                          <span className="relative z-[1] ml-auto rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                            Top
                          </span>
                        ) : null}
                      </button>
                    </div>
                  )
                })}
              </nav>

              {/* Content */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {/* Mobile section picker */}
                <div className="shrink-0 border-b border-border px-4 py-3 sm:hidden">
                  <label className="text-xs font-medium text-muted">
                    Section
                    <select
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                      value={section}
                      onChange={(e) =>
                        openSection(e.target.value as PreferencesSectionId)
                      }
                    >
                      {NAV.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div
                  ref={contentScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6"
                >
                  <AnimatePresence mode="wait" custom={sectionDir} initial={false}>
                    <motion.div
                      key={section}
                      custom={sectionDir}
                      initial={
                        reduceMotion
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              x: sectionDir > 0 ? 18 : -18,
                              y: 6,
                            }
                      }
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      exit={
                        reduceMotion
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              x: sectionDir > 0 ? -14 : 14,
                              y: -4,
                            }
                      }
                      transition={{
                        duration: reduceMotion ? 0.1 : 0.26,
                        ease: easeOut,
                      }}
                    >
                      <SectionBody id={section} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Full-width save bar — always visible under nav + content */}
            <PreferencesSaveFooter />
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
