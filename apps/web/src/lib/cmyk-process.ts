export const DEFAULT_CMYK_PROCESS = {
  cyan: '#0ea5e9',
  magenta: '#d946ef',
  yellow: '#eab308',
  key: '#111827',
} as const

export type CmykProcess = {
  cyan: string
  magenta: string
  yellow: string
  key: string
}

/** Stable process-color pick so each square reads as part of the kit. */
export function processColorForKey(
  key: string,
  process: CmykProcess = DEFAULT_CMYK_PROCESS,
): string {
  const order = [process.cyan, process.magenta, process.yellow, process.key] as const
  let hash = 0
  const s = key.trim().toLowerCase()
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 33 + s.charCodeAt(i)) >>> 0
  }
  return order[hash % order.length] ?? process.cyan
}
