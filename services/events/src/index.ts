import express from 'express'
import { BevelEventSchema } from '@bevel/schema/events'

const app = express()
const port = Number(process.env.EVENTS_PORT ?? 43210)

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'bevel-events' })
})

/** Ingest platform events — wire to queue (SQS, Cloudflare Queues, etc.) in production. */
app.post('/ingest', (req, res) => {
  const parsed = BevelEventSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  console.log('[events]', parsed.data.type, parsed.data.tenantId)
  res.status(202).json({ accepted: true, id: parsed.data.id })
})

app.listen(port, () => {
  console.log(`BEVEL events service listening on :${port}`)
})