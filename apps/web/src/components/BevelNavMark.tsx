/**
 * Suite-nav Bevel mark — canonical Magenta /brand/bevel-mark.svg geometry.
 * Source of truth: https://admin.magenta.lvh.me/brand/bevel-mark.svg
 * BevelCutMark paths (18 viewBox scaled); ink facets, transparent exterior.
 * Use currentColor so dark suite chips invert cleanly.
 */
export function BevelNavMark({
  className = 'size-5',
  title = 'BEVEL',
}: {
  className?: string
  title?: string
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
      <g transform="translate(5 5) scale(3)" className="fill-current">
        <path
          d="M2 14.5V3.5L7.5 9 2 14.5Z"
          fill="currentColor"
          opacity="0.35"
        />
        <path d="M2 3.5h14L9 10.5 2 3.5Z" fill="currentColor" />
        <path
          d="M16 3.5v11L9 10.5 16 14.5V3.5Z"
          fill="currentColor"
          opacity="0.55"
        />
      </g>
    </svg>
  )
}
