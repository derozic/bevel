import type { Request, Response, NextFunction } from 'express'
import { extractBearer, verifyAuthToken } from './auth-verify.js'

/** Require a valid fleet realtime JWT on session archive routes. */
export async function requireRealtimeAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = extractBearer(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const claims = await verifyAuthToken(token)
  if (!claims) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return
  }
  ;(req as Request & { fleetAuth?: typeof claims }).fleetAuth = claims
  next()
}