import { defineRoom, defineServer } from 'colyseus'
import cors from 'cors'
import express from 'express'
import { requireRealtimeAuth } from './api-auth.js'
import { listSessionSummaries, readRecording, summarizeRecording } from './recording.js'
import { AgentSession } from './rooms/AgentSession.js'
import { FleetChannel } from './rooms/FleetChannel.js'
import { FleetLobby } from './rooms/FleetLobby.js'

export const server = defineServer({
  rooms: {
    fleet_lobby: defineRoom(FleetLobby),
    agent_session: defineRoom(AgentSession).filterBy(['sessionId']),
    fleet_channel: defineRoom(FleetChannel).filterBy(['channelSlug']),
  },
  express: (app) => {
    app.use(cors())
    app.use(express.json())

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', service: 'agents-realtime', colyseus: true })
    })

    app.get('/', (_req, res) => {
      res.json({
        service: 'Derozic Fleet Realtime',
        rooms: ['fleet_lobby', 'agent_session', 'fleet_channel'],
        matchmaker: '/matchmake',
      })
    })

    app.get('/api/sessions', requireRealtimeAuth, (_req, res) => {
      res.json({ sessions: listSessionSummaries() })
    })

    app.get('/api/sessions/:id', requireRealtimeAuth, (req, res) => {
      const summary = summarizeRecording(req.params.id)
      if (!summary) {
        res.status(404).json({ error: 'Session not found' })
        return
      }
      res.json(summary)
    })

    app.get('/api/sessions/:id/transcript', requireRealtimeAuth, (req, res) => {
      const events = readRecording(req.params.id)
      if (events.length === 0) {
        res.status(404).json({ error: 'Session not found' })
        return
      }
      res.json({ sessionId: req.params.id, events })
    })
  },
})