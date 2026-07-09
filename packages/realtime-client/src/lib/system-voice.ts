export const SYSTEM_SPEAKER = 'derozic'

export function formatSpeaker(speaker: string, speakerType: string): string {
  if (speakerType === 'system' || speaker === SYSTEM_SPEAKER) return '💜 derozic'
  if (speakerType === 'agent') return `◆ ${speaker}`
  return speaker
}