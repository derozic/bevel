/**
 * Magenta bevel-mark geometry, embellished for day-part atmosphere.
 * Paths locked to https://admin.magenta.lvh.me/brand/bevel-mark.svg
 * Colors from --bevel-mark-* (set on html[data-daypart] in daypart.css).
 */
export function BevelDaypartMark({
  className = 'size-5',
  title = 'BEVEL',
  showCrease = true,
  showGlint = true,
}: {
  className?: string
  title?: string
  /** Accent crease along the fold (signature bevel edge) */
  showCrease?: boolean
  /** Soft top-plane micro-highlight */
  showGlint?: boolean
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform="translate(5 5) scale(3)">
        {/* left facet */}
        <path d="M2 14.5V3.5L7.5 9 2 14.5Z" fill="var(--bevel-mark-left)" />
        {/* top plane (face) */}
        <path d="M2 3.5h14L9 10.5 2 3.5Z" fill="var(--bevel-mark-face)" />
        {/* right facet */}
        <path
          d="M16 3.5v11L9 10.5 16 14.5V3.5Z"
          fill="var(--bevel-mark-right)"
        />
        {showGlint ? (
          <path
            d="M3.2 4.4 L12.2 4.4 L9.1 8.0 L3.9 5.1 Z"
            fill="var(--bevel-mark-glint)"
          />
        ) : null}
        {showCrease ? (
          /* thin crease at fold — reads at 16px as a pixel of accent */
          <path
            d="M8.65 9.55 L9.35 9.55 L9.12 10.65 L8.88 10.65 Z"
            fill="var(--bevel-mark-crease)"
          />
        ) : null}
      </g>
    </svg>
  )
}
