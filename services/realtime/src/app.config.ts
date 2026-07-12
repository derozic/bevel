import { defineRoom, defineServer, matchMaker } from 'colyseus'
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

function programEventsAuthorized(req: express.Request): boolean {
  const key = process.env.FLEET_INTERNAL_API_KEY
  const header = req.header('x-fleet-internal-key')
  if (key && header === key) return true
  const ip = req.ip || req.socket.remoteAddress || ''
  const loopback =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('127.0.0.1')
  if (process.env.NODE_ENV !== 'production' && loopback) return true
  if (!key && loopback) return true
  return false
}

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
    // Reflect Origin so credentialed Colyseus matchmake (credentials:include)
    // works from *.lvh.me product hosts → realtime.bevel.lvh.me.
    // Never pair Access-Control-Allow-Credentials with "*".
    app.use(
      cors({
        origin: true,
        credentials: true,
        allowedHeaders: [
          'Origin',
          'X-Requested-With',
          'Content-Type',
          'Accept',
          'Authorization',
        ],
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      }),
    )
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

    /**
     * Agent programs (JOHNNY Caddy heal, etc.) → live channel message.
     * Auth: X-Fleet-Internal-Key or loopback in development.
     */
    app.post('/api/program-events', async (req, res) => {
      if (!programEventsAuthorized(req)) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      const body = req.body as {
        id?: string
        agentId?: string
        speakerName?: string
        body?: string
        message?: string
        channelSlug?: string
        tags?: string[]
        persist?: boolean
      }
      const text = (body.body || body.message || '').trim()
      if (!text) {
        res.status(400).json({ error: 'body required' })
        return
      }
      const channelSlug = (body.channelSlug || 'general').toLowerCase()
      const payload = {
        id: body.id,
        agentId: body.agentId || 'johnny',
        speakerName: body.speakerName,
        body: text,
        tags: body.tags ?? ['program'],
        persist: body.persist !== false,
      }

      try {
        const rooms = await matchMaker.query({
          name: 'fleet_channel',
          channelSlug,
        })
        const injected: Array<{ roomId: string; id: string }> = []
        for (const listing of rooms) {
          try {
            const result = (await matchMaker.remoteRoomCall(
              listing.roomId,
              'injectProgramEvent',
              [payload],
            )) as { id: string; channelSlug: string }
            injected.push({ roomId: listing.roomId, id: result.id })
          } catch {
            // room may have disposed between query and call
          }
        }
        res.json({
          ok: true,
          channelSlug,
          liveRooms: rooms.length,
          injected,
          // When no live room, caller should still persist via fleet API
          note:
            rooms.length === 0
              ? 'No live fleet_channel room; persist via fleet messages API for next join'
              : undefined,
        })
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : 'inject failed',
        })
      }
    })
  },
})