export const HAIL_NEED = 3

export const HAIL_AGENTS = [
  { id: 'hermes', name: 'Hermes', radius: 36, duration: 11, angle: 20 },
  { id: 'johnny', name: 'JOHNNY', radius: 50, duration: 16, angle: 110 },
  { id: 'brain', name: 'Brain', radius: 62, duration: 22, angle: 200 },
  { id: 'loom', name: 'Loom', radius: 44, duration: 13, angle: 290 },
] as const

export function hailProgress(hailedIds: readonly string[], need = HAIL_NEED) {
  const unique = [...new Set(hailedIds.filter(Boolean))]
  const count = Math.min(unique.length, need)
  return {
    unique,
    count,
    need,
    locked: count >= need,
    remaining: Math.max(0, need - count),
  }
}
