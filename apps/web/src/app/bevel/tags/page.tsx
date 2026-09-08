import Link from 'next/link'
import {
  bevelApiFetch,
  hostTenantSlug,
  withTenantQuery,
} from '@/lib/bevel-api.server'
import { bevelTagPath } from '@/lib/bevel'

type TagCloudRow = {
  slug: string
  count: number
  agents: number
  people: number
  tracks: number
}

export default async function TagsIndexPage() {
  let tags: TagCloudRow[] = []
  try {
    const tenant = await hostTenantSlug()
    const res = await bevelApiFetch(withTenantQuery('/api/v1/tags', tenant))
    const data = (await res.json().catch(() => ({}))) as { tags?: TagCloudRow[] }
    tags = Array.isArray(data.tags) ? data.tags : []
  } catch {
    tags = []
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-10 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Folksonomy
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Tags
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            Freeform labels people put on agents, people, and tracks. The
            vocabulary is whatever the workspace uses.
          </p>
        </header>

        {tags.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            No tags yet. Open a track, a person, or an agent and add one.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag.slug}>
                <Link
                  href={bevelTagPath(tag.slug)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition hover:border-accent/40"
                >
                  <span className="font-medium">{tag.slug}</span>
                  <span className="text-[11px] text-muted">{tag.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
