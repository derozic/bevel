/**
 * Rich suite-nav Bevel mark (Slack / OpenAI chip density).
 * Same fold geometry as BevelCutMark; layered facets + green crease.
 * Scales cleanly from 16px to 2xl via viewBox.
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
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient
          id="bevelNavTop"
          x1="2"
          y1="3.5"
          x2="16"
          y2="10.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F4F7F5" />
          <stop offset="0.55" stopColor="#E8ECEA" />
          <stop offset="1" stopColor="#C5CCC8" />
        </linearGradient>
        <linearGradient
          id="bevelNavLeft"
          x1="2"
          y1="3.5"
          x2="7.5"
          y2="14.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#3D4A44" />
          <stop offset="1" stopColor="#1A2220" />
        </linearGradient>
        <linearGradient
          id="bevelNavRight"
          x1="9"
          y1="10.5"
          x2="16"
          y2="14.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2A3530" />
          <stop offset="1" stopColor="#0F1412" />
        </linearGradient>
        <linearGradient
          id="bevelNavEdge"
          x1="8.5"
          y1="9"
          x2="9.5"
          y2="11"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4ADE80" />
          <stop offset="1" stopColor="#22C55E" />
        </linearGradient>
      </defs>
      <g transform="translate(2 2) scale(2)">
        <path d="M2 14.5V3.5L7.5 9 2 14.5Z" fill="url(#bevelNavLeft)" />
        <path d="M2 3.5h14L9 10.5 2 3.5Z" fill="url(#bevelNavTop)" />
        <path d="M16 3.5v11L9 10.5 16 14.5V3.5Z" fill="url(#bevelNavRight)" />
        <path
          d="M8.55 9.7 L9.45 9.7 L9.15 10.55 L8.85 10.55 Z"
          fill="url(#bevelNavEdge)"
          opacity="0.95"
        />
        <path
          d="M3.2 4.4 L12.5 4.4 L9.2 8.2 L3.8 5.2 Z"
          fill="#FFFFFF"
          opacity="0.18"
        />
      </g>
    </svg>
  )
}
