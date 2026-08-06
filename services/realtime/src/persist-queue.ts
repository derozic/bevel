/**
 * Tracks in-flight durable writes so SIGTERM / room dispose can drain them
 * instead of dropping mid-flight conversation turns.
 */

type PersistTask = {
  key: string
  promise: Promise<boolean>
}

const tasks = new Map<string, PersistTask>()
let draining = false

/**
 * Enqueue a persist op keyed by message id (or any stable key).
 * Re-enqueue with the same key replaces the tracked promise (streaming updates).
 */
export function enqueuePersist(
  key: string,
  run: () => Promise<boolean>,
): Promise<boolean> {
  const promise = run().finally(() => {
    const current = tasks.get(key)
    if (current?.promise === promise) {
      tasks.delete(key)
    }
  })
  tasks.set(key, { key, promise })
  return promise
}

export function pendingPersistCount(): number {
  return tasks.size
}

/**
 * Await outstanding persists (best-effort). Used on room dispose and process exit.
 * @returns number of tasks that were still pending when flush started
 */
export async function flushPersistQueue(timeoutMs = 10_000): Promise<number> {
  if (tasks.size === 0) return 0
  draining = true
  const pending = [...tasks.values()]
  const count = pending.length
  try {
    await Promise.race([
      Promise.allSettled(pending.map((t) => t.promise)),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ])
  } finally {
    draining = false
  }
  return count
}

export function isPersistDraining(): boolean {
  return draining
}

let hooksInstalled = false

/** Install once — drain on SIGTERM/SIGINT before process exit. */
export function installPersistShutdownHooks(): void {
  if (hooksInstalled) return
  hooksInstalled = true

  const onSignal = (signal: string) => {
    void (async () => {
      const n = tasks.size
      if (n > 0) {
        console.log(`[persist-queue] ${signal}: draining ${n} write(s)…`)
        const drained = await flushPersistQueue(12_000)
        console.log(`[persist-queue] drained (started with ${drained})`)
      } else {
        console.log(`[persist-queue] ${signal}: nothing to drain`)
      }
      // Replace default signal exit so we always finish after the drain.
      process.exit(0)
    })()
  }

  process.once('SIGTERM', () => onSignal('SIGTERM'))
  process.once('SIGINT', () => onSignal('SIGINT'))
}
