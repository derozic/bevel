import { Encoder } from '@colyseus/schema'
import { server } from './app.config.js'
import { config } from './config.js'
import { installPersistShutdownHooks } from './persist-queue.js'

// Channel hydrate (100 messages + presence) overflows the 8KB default and
// disconnects browsers mid-join. Production ~general already hit this.
Encoder.BUFFER_SIZE = 256 * 1024

installPersistShutdownHooks()

server.listen(config.port, '127.0.0.1')

// Do not call simulateLatency() in local Caddy/dev. It patches
// WebSocketClient.raw, delays the join handshake, and Colyseus then
// rejects the socket as "seat reservation expired" (close 4002).
if (process.env.COLYSEUS_SIMULATE_LATENCY_MS) {
  const ms = Number(process.env.COLYSEUS_SIMULATE_LATENCY_MS)
  if (Number.isFinite(ms) && ms > 0) {
    server.simulateLatency(ms)
  }
}

console.log(`Derozic fleet realtime listening on :${config.port}`)