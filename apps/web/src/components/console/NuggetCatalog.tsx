'use client'

import { NuggetCard } from '@bevel/realtime-client'
import { NUGGET_EXAMPLES } from '@/lib/nugget-examples'

export function NuggetCatalog({
  lane,
}: {
  lane: 'all' | 'mcp' | 'inbound'
}) {
  if (lane === 'mcp') {
    return (
      <div className="rounded-xl border border-border/40 bg-surface/20 p-4 text-sm text-text-muted leading-relaxed">
        <p className="font-semibold text-text">MCP is a lane, not a separate app.</p>
        <p className="mt-1">
          Each integration can expose an MCP server so agents (Hermes, Claude, Grok)
          query the service. Magenta, Slack, and Bevel itself live here. Inbound
          webhooks still post nuggets into channels — same catalog, opposite
          direction.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
          Channel nuggets
        </p>
        <p className="mt-1 text-sm text-text-muted max-w-3xl leading-relaxed">
          Brad Frost scale, lintable for agents:{' '}
          <strong className="text-text">atom</strong> (indivisible),{' '}
          <strong className="text-text">molecule</strong> (bonded atoms),{' '}
          <strong className="text-text">organism</strong> (complex preview),{' '}
          <strong className="text-text">template</strong> (page partial in the
          right pane), <strong className="text-text">page</strong> (full
          instance, full width). A CMYK BrandKit share is an organism that
          opens its token molecule.
        </p>
      </div>
      <div className="bevel-nugget-gallery">
        {NUGGET_EXAMPLES.map((nugget) => (
          <NuggetCard key={`${nugget.source}-${nugget.title}`} nugget={nugget} />
        ))}
      </div>
    </section>
  )
}
