import { Room } from 'colyseus'
import {
  subscribeIntelligence,
  workingSnapshot,
  type IntelligenceEvent,
} from '../intelligence.js'
import { loadMergedRegistry } from '../registry-merge.js'
import { AgentPresence, FleetLobbyState } from '../schema/ChatState.js'

type JoinOptions = {
  displayName?: string
}

export class FleetLobby extends Room {
  maxClients = 128
  declare state: FleetLobbyState
  private stopIntelligence: (() => void) | null = null

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

    for (const key of workingSnapshot()) {
      this.state.workingKeys.push(key)
    }
    this.stopIntelligence = subscribeIntelligence((event) => {
      this.applyIntelligence(event)
    })

    this.onMessage('ping', (client) => {
      client.send('pong', { ts: Date.now() })
    })
  }

  onDispose() {
    this.stopIntelligence?.()
    this.stopIntelligence = null
  }

  private applyIntelligence(event: IntelligenceEvent) {
    if (event.phase === 'working') {
      for (const key of event.keys) {
        if (!this.state.workingKeys.includes(key)) this.state.workingKeys.push(key)
      }
      return
    }
    for (const key of event.keys) {
      const index = this.state.workingKeys.indexOf(key)
      if (index >= 0) this.state.workingKeys.splice(index, 1)
    }
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