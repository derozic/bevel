/**
 * Geometric cut-mark icon used in marketing headers (logo tile + wordmark).
 * Square viewBox — always object-contain; never stretch/skew.
 */
export function BevelCutMark({
  className = 'size-[18px] text-accent',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <path d="M2 14.5V3.5L7.5 9 2 14.5Z" fill="currentColor" opacity="0.35" />
      <path d="M2 3.5h14L9 10.5 2 3.5Z" fill="currentColor" />
      <path
        d="M16 3.5v11L9 10.5 16 14.5V3.5Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  )
}
