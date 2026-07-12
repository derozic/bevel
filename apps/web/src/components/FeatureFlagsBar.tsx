import type { ReactNode } from 'react'
import {
  FEATURE_CATALOG,
  FEATURE_FLAG_IDS,
  type FeatureAccess,
  type FeatureFlagId,
  type ResolvedFeatureSet,
  type TenantPlan,
} from '@bevel/schema'
import { cn } from '@bevel/ui'

export type FeatureFlagsBarProps = {
  plan?: TenantPlan | string
  featureAccess?: FeatureAccess | string
  /** Full resolved set from tenant.featureSet */
  featureSet?: ResolvedFeatureSet | null
  /** Or pass enabled flag ids directly */
  enabled?: FeatureFlagId[]
  /** compact: single line for rail / prefs; default: footer strip */
  compact?: boolean
  className?: string
}

/**
 * Visible plan + release access + active feature chips.
 * Used in marketing footer, prefs footer, and workspace rail.
 */
export function FeatureFlagsBar({
  plan = 'free',
  featureAccess = 'stable',
  featureSet,
  enabled,
  compact = false,
  className,
}: FeatureFlagsBarProps) {
  const planLabel = String(plan)
  const accessLabel = String(featureAccess)

  const activeIds: FeatureFlagId[] =
    enabled ??
    (featureSet
      ? FEATURE_FLAG_IDS.filter((id) => Boolean(featureSet[id]))
      : [])

  // Prefer showing paid/preview flags so the strip stays readable
  const highlight = activeIds.filter((id) => {
    const def = FEATURE_CATALOG[id]
    return def.paidOnly || def.release !== 'stable'
  })
  const chips = (highlight.length > 0 ? highlight : activeIds).slice(
    0,
    compact ? 6 : 12,
  )
  const more =
    (highlight.length > 0 ? highlight : activeIds).length - chips.length

  return (
    <div
      className={cn(
        'feature-flags-bar',
        compact
          ? 'flex flex-wrap items-center gap-1.5 text-[10px]'
          : 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      data-plan={planLabel}
      data-feature-access={accessLabel}
      aria-label={`Plan ${planLabel}, feature access ${accessLabel}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <FlagPill tone={planTone(planLabel)} title="Product plan">
          plan:{planLabel}
        </FlagPill>
        <FlagPill
          tone={accessTone(accessLabel)}
          title="Release channel (stable / beta / upcoming)"
        >
          access:{accessLabel}
        </FlagPill>
        {featureSet?._isTrial ? (
          <FlagPill tone="trial" title="Trial plan">
            trial
          </FlagPill>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <ul
          className={cn(
            'flex flex-wrap items-center gap-1',
            compact ? 'max-w-full' : 'sm:justify-end',
          )}
          aria-label="Active feature flags"
        >
          {chips.map((id) => {
            const def = FEATURE_CATALOG[id]
            return (
              <li key={id}>
                <FlagPill
                  tone={
                    def.release === 'upcoming'
                      ? 'upcoming'
                      : def.release === 'beta'
                        ? 'beta'
                        : def.paidOnly
                          ? 'paid'
                          : 'core'
                  }
                  title={`${def.label} — ${def.description} (${def.release}, min ${def.minPlan})`}
                >
                  {id}
                  {def.release !== 'stable' ? (
                    <span className="opacity-70">·{def.release}</span>
                  ) : null}
                </FlagPill>
              </li>
            )
          })}
          {more > 0 ? (
            <li>
              <FlagPill tone="muted" title={`${more} more flags enabled`}>
                +{more}
              </FlagPill>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}

function FlagPill({
  children,
  tone,
  title,
}: {
  children: ReactNode
  tone: 'free' | 'paid' | 'trial' | 'beta' | 'upcoming' | 'core' | 'muted'
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono font-medium leading-none tracking-tight',
        tone === 'free' &&
          'border-border bg-background/60 text-muted',
        tone === 'paid' &&
          'border-accent/35 bg-accent/10 text-accent',
        tone === 'trial' &&
          'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        tone === 'beta' &&
          'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
        tone === 'upcoming' &&
          'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
        tone === 'core' &&
          'border-border/80 bg-surface text-muted',
        tone === 'muted' &&
          'border-transparent bg-transparent text-muted/70',
      )}
    >
      {children}
    </span>
  )
}

function planTone(
  plan: string,
): 'free' | 'paid' | 'trial' {
  if (plan === 'free') return 'free'
  if (plan === 'trial') return 'trial'
  return 'paid'
}

function accessTone(
  access: string,
): 'free' | 'beta' | 'upcoming' {
  if (access === 'upcoming') return 'upcoming'
  if (access === 'beta') return 'beta'
  return 'free'
}
