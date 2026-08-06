import { server } from './app.config.js'
import { config } from './config.js'
import { installPersistShutdownHooks } from './persist-queue.js'

installPersistShutdownHooks()

server.listen(config.port)

if (config.nodeEnv !== 'production') {
  try {
    server.simulateLatency(80)
  } catch {
    // optional in test contexts
  }
}

console.log(`Derozic fleet realtime listening on :${config.port}`)