import type { ArraySchema } from '@colyseus/schema'
import type { HumanPresence } from './schema/ChatState.js'

/** Drop stale connections for the same signed-in user (tabs, HMR, reconnects). */
export function removeHumansByUserId(
  humans: ArraySchema<HumanPresence>,
  userId: string
): void {
  if (!userId) return
  for (let i = humans.length - 1; i >= 0; i--) {
    if (humans[i]?.userId === userId) {
      humans.splice(i, 1)
    }
  }
}