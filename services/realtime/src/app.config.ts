import { defineRoom, defineServer } from 'colyseus'
import cors from 'cors'
import express from 'express'
import { requireRealtimeAuth } from './api-auth.js'
import { listSessionSummaries, readRecording, summarizeRecording } from './recording.js'
import { AgentSession } from './rooms/AgentSession.js'
import { FleetChannel } from './rooms/FleetChannel.js'
import { FleetLobby } from './rooms/FleetLobby.js'
import {
  conversationSearchIndex,
  rebuildConversationSearchIndex,
} from './search-index.js'

// Build search index from JSONL archives as soon as the process starts.
const bootIndex = rebuildConversationSearchIndex()
console.log(
  `[search-index] ready — ${bootIndex.documents} messages across ${bootIndex.sessions} sessions`,
)

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
      res.json({
        status: 'ok',
        service: 'agents-realtime',
        colyseus: true,
        searchIndex: {
          ready: conversationSearchIndex.isReady(),
          documents: conversationSearchIndex.size,
        },
      })
    })

    app.get('/', (_req, res) => {
      res.json({
        service: 'Derozic Fleet Realtime',
        rooms: ['fleet_lobby', 'agent_session', 'fleet_channel'],
        matchmaker: '/matchmake',
        search: '/api/search?q=',
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

    /**
     * Bookmark-style conversation search.
     * Each hit includes href + messageId so the client can open the room and
     * scroll to the exact line with query highlighting.
     */
    app.get('/api/search', requireRealtimeAuth, (req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q : ''
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 25
      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(1, limitRaw), 50)
        : 25

      if (!conversationSearchIndex.isReady()) {
        rebuildConversationSearchIndex()
      }

      const hits = conversationSearchIndex.search(q, { limit })
      res.json({
        q,
        count: hits.length,
        indexSize: conversationSearchIndex.size,
        hits,
      })
    })

    app.post('/api/search/rebuild', requireRealtimeAuth, (_req, res) => {
      const result = rebuildConversationSearchIndex()
      res.json({ ok: true, ...result })
    })
  },
})