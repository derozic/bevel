import { Room } from 'colyseus'
import { loadMergedRegistry } from '../registry-merge.js'
import { AgentPresence, FleetLobbyState } from '../schema/ChatState.js'

type JoinOptions = {
  displayName?: string
}

export class FleetLobby extends Room {
  maxClients = 128
  declare state: FleetLobbyState

  onCreate() {
    this.setState(new FleetLobbyState())
    this.state.roomId = this.roomId

    const catalog = loadMergedRegistry()
    for (const agent of catalog) {
      const row = new AgentPresence()
      row.id = agent.id
      row.name = agent.name
      row.accent = agent.accent ?? '#1a1410'
      row.source = agent.federated ? 'federated' : 'fleet'
      row.status = agent.status === 'busy' ? 'thinking' : 'idle'
      this.state.agents.push(row)
    }

    this.onMessage('ping', (client) => {
      client.send('pong', { ts: Date.now() })
    })
  }

  onJoin() {
    this.state.onlineHumans = this.clients.length
  }

  onLeave() {
    this.state.onlineHumans = this.clients.length
  }

  registerSession(sessionId: string) {
    if (!this.state.activeSessions.includes(sessionId)) {
      this.state.activeSessions.push(sessionId)
    }
  }
}