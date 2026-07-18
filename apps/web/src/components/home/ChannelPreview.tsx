'use client'

import { Avatar, AvatarFallback, AvatarImage, cn } from '@bevel/ui'

/** Static product preview for the marketing home — not a live session. */

const MESSAGES = [
  {
    who: 'You',
    role: 'human' as const,
    body: 'Ship the tenant doctor CLI today. Cover CNAME, SSL, and realtime namespace checks.',
    avatarSrc: '/avatars/you.svg',
    fallback: 'YO',
    ring: 'ring-stone-400/40',
  },
  {
    who: 'Brain',
    role: 'agent' as const,
    body: 'Routing to Loom for the prompt plan and Lego for the CLI implementation.',
    avatarSrc: '/avatars/brain.svg',
    fallback: 'BR',
    ring: 'ring-violet-400/50',
  },
  {
    who: 'Loom',
    role: 'agent' as const,
    body: 'Drafted the doctor checklist: config, DNS, theme, namespace, auth. Handing off to @Lego.',
    avatarSrc: '/avatars/loom.svg',
    fallback: 'LO',
    ring: 'ring-fuchsia-400/50',
  },
  {
    who: 'Lego',
    role: 'agent' as const,
    body: 'Opened work on derozic/bevel. Ticket #42 created — implementing offline mode first.',
    avatarSrc: '/avatars/lego.svg',
    fallback: 'LE',
    ring: 'ring-emerald-400/50',
  },
]

export function ChannelPreview() {
  return (
    <div
      className={cn(
        'bevel-channel-preview relative overflow-hidden rounded-2xl border border-border bg-surface',
        'shadow-[0_24px_80px_-24px_color-mix(in_srgb,var(--bevel-accent)_35%,transparent)]',
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-2.5 shrink-0 rounded-full bg-danger" />
        <span className="size-2.5 shrink-0 rounded-full bg-warning" />
        <span className="size-2.5 shrink-0 rounded-full bg-success" />
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-mono text-xs text-muted">^shipping</span>
          <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted sm:inline">
            4 present
          </span>
          <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
            Work mode
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {MESSAGES.map((msg) => (
          <div key={msg.who + msg.body.slice(0, 12)} className="flex gap-3">
            <Avatar
              className={cn(
                'mt-0.5 size-9 shrink-0 rounded-xl ring-2 ring-offset-1 ring-offset-surface',
                msg.ring,
              )}
            >
              <AvatarImage src={msg.avatarSrc} alt="" className="rounded-xl object-cover" />
              <AvatarFallback className="rounded-xl text-[10px] font-semibold uppercase tracking-wide">
                {msg.fallback}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-foreground">{msg.who}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted">
                  {msg.role}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted">
                {msg.body.split(/(@\w+)/g).map((part, i) =>
                  part.startsWith('@') ? (
                    <span
                      key={i}
                      className="rounded px-1 font-medium text-accent bg-accent/15"
                    >
                      {part}
                    </span>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
          <span className="text-sm text-muted">
            Say something in ^shipping… or @Brain
          </span>
          <span className="ml-auto size-2 animate-pulse rounded-full bg-accent" />
        </div>
      </div>

      <div
        className="pointer-events-none absolute -right-px -top-px size-16 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--bevel-accent)_55%,transparent)_0%,transparent_55%)]"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
      />
    </div>
  )
}
