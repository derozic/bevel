import { ArraySchema, Schema, type } from '@colyseus/schema'

export class ChatMessage extends Schema {
  @type('string') id: string = ''
  @type('string') sessionId: string = ''
  @type('string') speaker: string = ''
  @type('string') speakerId: string = ''
  @type('string') speakerAvatar: string = ''
  @type('string') speakerType: string = 'human' // human | agent | system
  @type('string') agentId: string = ''
  @type('string') body: string = ''
  @type('string') status: string = 'final' // pending | streaming | final | error
  @type('number') ts: number = 0
}

export class HumanPresence extends Schema {
  @type('string') clientId: string = ''
  @type('string') userId: string = ''
  @type('string') name: string = ''
  @type('string') avatar: string = ''
}

export class AgentPresence extends Schema {
  @type('string') id: string = ''
  @type('string') name: string = ''
  @type('string') accent: string = '#1a1410'
  @type('string') source: string = 'fleet' // fleet | federated
  @type('string') status: string = 'idle' // idle | thinking | speaking
}

export class FleetLobbyState extends Schema {
  @type('string') roomId: string = ''
  @type('number') onlineHumans: number = 0
  @type(['string']) activeSessions = new ArraySchema<string>()
  @type([AgentPresence]) agents = new ArraySchema<AgentPresence>()
}

export class AgentSessionState extends Schema {
  @type('string') sessionId: string = ''
  @type('string') title: string = ''
  @type('string') poweredByLabel: string = ''
  @type(['string']) agentIds = new ArraySchema<string>()
  @type([ChatMessage]) messages = new ArraySchema<ChatMessage>()
  @type([AgentPresence]) agents = new ArraySchema<AgentPresence>()
  @type([HumanPresence]) humans = new ArraySchema<HumanPresence>()
  @type('string') status: string = 'active'
  @type('number') createdAt: number = 0
}

export class FleetChannelState extends Schema {
  @type('string') channelSlug: string = ''
  @type('string') title: string = ''
  @type('string') poweredByLabel: string = ''
  @type(['string']) tags = new ArraySchema<string>()
  @type(['string']) agentIds = new ArraySchema<string>()
  @type([ChatMessage]) messages = new ArraySchema<ChatMessage>()
  @type([AgentPresence]) agents = new ArraySchema<AgentPresence>()
  @type([HumanPresence]) humans = new ArraySchema<HumanPresence>()
  @type('string') status: string = 'active'
  @type('number') createdAt: number = 0
}