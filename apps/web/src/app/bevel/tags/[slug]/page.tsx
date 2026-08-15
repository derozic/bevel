import Link from 'next/link'
import { notFound } from 'next/navigation'
import { bevelApiFetch } from '@/lib/bevel-api.server'
import { BEVEL_TAGS_PATH } from '@/lib/bevel'

type Tagged = {
  kind: string
  id: string
  name: string
  handle?: string
  href: string
  role?: string
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  let agents: Tagged[] = []
  let people: Tagged[] = []
  let tracks: Tagged[] = []
  let resolved = slug
  try {
    const res = await bevelApiFetch(`/api/v1/tags/${encodeURIComponent(slug)}`)
    if (res.status === 404) notFound()
    const data = (await res.json().catch(() => ({}))) as {
      slug?: string
      agents?: Tagged[]
      people?: Tagged[]
      tracks?: Tagged[]
    }
    resolved = data.slug || slug
    agents = data.agents ?? []
    people = data.people ?? []
    tracks = data.tracks ?? []
  } catch {
    agents = []
  }

  const empty = agents.length + people.length + tracks.length === 0

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-10 space-y-8">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            <Link href={BEVEL_TAGS_PATH} className="hover:text-foreground">
              Tags
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {resolved}
          </h1>
          <p className="text-sm text-muted">
            Agents, people, and tracks wearing this tag.
          </p>
        </header>

        {empty ? (
          <p className="text-sm text-muted">Nothing tagged {resolved} yet.</p>
        ) : null}

        <TagGroup title="Tracks" hint="~rooms" items={tracks} />
        <TagGroup title="Agents" hint="direct" items={agents} />
        <TagGroup title="People" hint="@handle" items={people} />
      </div>
    </div>
  )
}

function TagGroup({
  title,
  hint,
  items,
}: {
  title: string
  hint: string
  items: Tagged[]
}) {
  if (items.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
        <span className="ml-2 font-normal normal-case tracking-normal">
          {hint}
        </span>
      </h2>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={`${item.kind}:${item.id}`}>
            <Link
              href={item.href}
              className="flex items-center justify-between rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm transition hover:border-accent/40"
            >
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="font-mono text-xs text-muted">
                {item.handle ? `@${item.handle}` : item.id}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
