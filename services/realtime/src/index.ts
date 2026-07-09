import { server } from './app.config.js'
import { config } from './config.js'

server.listen(config.port)

if (config.nodeEnv !== 'production') {
  try {
    server.simulateLatency(80)
  } catch {
    // optional in test contexts
  }
}

console.log(`Derozic fleet realtime listening on :${config.port}`)