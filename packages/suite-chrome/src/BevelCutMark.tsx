/**
 * Portable suite-dock cut mark (Magenta geometry, day-part CSS vars).
 * Hosts without daypart.css still get sensible currentColor + crease fallback.
 */
export function BevelCutMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      width="18"
      height="18"
      fill="none"
      aria-hidden
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform="translate(5 5) scale(3)">
        <path d="M2 14.5V3.5L7.5 9 2 14.5Z" fill="var(--bevel-mark-left, currentColor)" opacity="0.45" />
        <path d="M2 3.5h14L9 10.5 2 3.5Z" fill="var(--bevel-mark-face, currentColor)" />
        <path
          d="M16 3.5v11L9 10.5 16 14.5V3.5Z"
          fill="var(--bevel-mark-right, currentColor)"
          opacity="0.7"
        />
        <path
          d="M3.2 4.4 L12.2 4.4 L9.1 8.0 L3.9 5.1 Z"
          fill="var(--bevel-mark-glint, currentColor)"
          opacity="0.2"
        />
        <path
          d="M8.65 9.55 L9.35 9.55 L9.12 10.65 L8.88 10.65 Z"
          fill="var(--bevel-mark-crease, #7c5cff)"
        />
      </g>
    </svg>
  )
}
