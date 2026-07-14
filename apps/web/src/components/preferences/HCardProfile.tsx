'use client'

import {
  SOCIAL_NETWORKS,
  validateHttpUrl,
  validateSocialUrl,
  type SocialNetworkId,
} from '@bevel/schema'

/**
 * Visible h-card (microformats2) + schema.org Person for the member profile.
 * Socials use rel=me (IndieWeb). Default networks: X, Instagram, TikTok, YouTube.
 * Tags / attributes surface agent-facing capability context in the card preview.
 * Only valid endpoints are rendered (invalid drafts stay out of rel=me).
 * @see https://microformats.org/wiki/h-card
 * @see https://indieweb.org/rel-me
 */
export function HCardProfile({
  displayName,
  givenName,
  familyName,
  nickname,
  handle,
  bio,
  description,
  pronouns,
  timezone,
  url,
  email,
  emailPublic,
  org,
  jobTitle,
  location,
  photoUrl,
  tags = [],
  attributes = [],
  socials,
}: {
  displayName: string
  givenName?: string
  familyName?: string
  nickname?: string
  handle: string
  bio: string
  description?: string
  pronouns?: string
  timezone?: string
  url?: string
  email?: string | null
  emailPublic: boolean
  org?: string
  jobTitle?: string
  location?: string
  photoUrl?: string
  tags?: string[]
  attributes?: { key: string; value: string }[]
  socials: {
    x: string
    instagram: string
    tiktok: string
    youtube: string
  }
}) {
  const name = displayName || nickname || handle || 'Member'
  const socialLinks = SOCIAL_NETWORKS.map((id: SocialNetworkId) => {
    const result = validateSocialUrl(id, socials[id] ?? '')
    return {
      href: result.ok ? result.value : '',
      label:
        id === 'x'
          ? 'X'
          : id === 'instagram'
            ? 'Instagram'
            : id === 'tiktok'
              ? 'TikTok'
              : 'YouTube',
      network: id,
    }
  })
  const website = validateHttpUrl(url ?? '', 'Website')
  const links = [
    ...socialLinks,
    {
      href: website.ok ? website.value : '',
      label: 'Website',
      network: 'web',
    },
  ].filter((l) => l.href && l.href.trim().length > 0)
  const safePhoto =
    photoUrl && validateHttpUrl(photoUrl, 'Photo').ok ? photoUrl : undefined

  const cleanTags = tags.map((t) => t.trim()).filter(Boolean)
  const cleanAttrs = attributes.filter(
    (a) => a.key?.trim() && a.value?.trim(),
  )

  return (
    <article
      className="h-card vcard rounded-2xl border border-border bg-background/60 p-4"
      itemScope
      itemType="https://schema.org/Person"
      data-microformats="h-card"
    >
      <div className="flex items-start gap-4">
        {safePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="u-photo photo size-16 rounded-full border border-border object-cover"
            src={safePhoto}
            alt=""
            itemProp="image"
          />
        ) : (
          <div
            className="flex size-16 items-center justify-center rounded-full bg-accent/15 text-xl font-semibold text-accent"
            aria-hidden
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className="p-name fn text-base font-semibold text-foreground"
            itemProp="name"
          >
            {name}
          </p>
          {(givenName || familyName) && (
            <p className="text-xs text-muted">
              {givenName ? (
                <span className="p-given-name" itemProp="givenName">
                  {givenName}
                </span>
              ) : null}
              {givenName && familyName ? ' ' : null}
              {familyName ? (
                <span className="p-family-name" itemProp="familyName">
                  {familyName}
                </span>
              ) : null}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
            {handle ? (
              <span
                className="p-nickname nickname"
                itemProp="alternateName"
              >
                @{handle.replace(/^@/, '')}
              </span>
            ) : null}
            {pronouns?.trim() ? (
              <span className="text-xs" itemProp="gender">
                · {pronouns.trim()}
              </span>
            ) : null}
          </div>
          {jobTitle || org ? (
            <p className="text-sm text-muted">
              {jobTitle ? (
                <span className="p-job-title" itemProp="jobTitle">
                  {jobTitle}
                </span>
              ) : null}
              {jobTitle && org ? ' · ' : null}
              {org ? (
                <span className="p-org org" itemProp="worksFor">
                  {org}
                </span>
              ) : null}
            </p>
          ) : null}
          {location || timezone ? (
            <p className="text-xs text-muted">
              {location ? (
                <span
                  className="p-locality locality"
                  itemProp="homeLocation"
                >
                  {location}
                </span>
              ) : null}
              {location && timezone ? ' · ' : null}
              {timezone ? <span>{timezone}</span> : null}
            </p>
          ) : null}
        </div>
      </div>

      {bio ? (
        <p
          className="p-note note mt-3 text-sm leading-relaxed text-foreground/90"
          itemProp="description"
        >
          {bio}
        </p>
      ) : null}

      {description?.trim() && description.trim() !== bio.trim() ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted/80">
            For agents
          </span>
          {description.trim()}
        </p>
      ) : null}

      {cleanTags.length > 0 ? (
        <ul
          className="mt-3 flex flex-wrap gap-1.5"
          aria-label="Capability tags"
        >
          {cleanTags.map((tag) => (
            <li key={tag}>
              <span
                className="p-category inline-flex rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-foreground"
                itemProp="knowsAbout"
              >
                {tag}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {cleanAttrs.length > 0 ? (
        <dl className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {cleanAttrs.map((a) => (
            <div
              key={`${a.key}:${a.value}`}
              className="rounded-lg border border-border/70 bg-surface/60 px-2.5 py-1.5"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {a.key.trim()}
              </dt>
              <dd className="mt-0.5 text-sm text-foreground">{a.value.trim()}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={`${l.network}-${l.href}`}>
            <a
              className="u-url url rounded-full border border-border px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10"
              href={l.href}
              rel="me noopener noreferrer"
              target="_blank"
              itemProp="sameAs"
              data-network={l.network}
            >
              {l.label}
            </a>
          </li>
        ))}
        {emailPublic && email ? (
          <li>
            <a
              className="u-email email rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground"
              href={`mailto:${email}`}
              itemProp="email"
            >
              Email
            </a>
          </li>
        ) : null}
      </ul>
      <p className="mt-3 text-[10px] uppercase tracking-wide text-muted/80">
        h-card · schema.org/Person · rel=me · agent context
      </p>
    </article>
  )
}
