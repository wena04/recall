import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';

export type AuthMode = 'user' | 'agent';

export interface AuthedRequest extends Request {
  auth?: { mode: AuthMode; userId: string };
}

function getBearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (!h || !/^Bearer\s+/i.test(h)) return undefined;
  return h.replace(/^Bearer\s+/i, '').trim();
}

/** Mac agent + CLI ingest: shared secret `RECALL_AGENT_SECRET` as Bearer. */
export function requireAgentSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.RECALL_AGENT_SECRET?.trim();
  if (!expected) {
    res.status(503).json({
      error:
        'RECALL_AGENT_SECRET is not set on the server. Add it to .env / Vercel and redeploy.',
    });
    return;
  }
  const token = getBearer(req);
  if (!token || token !== expected) {
    res.status(401).json({ error: 'Invalid or missing agent credentials' });
    return;
  }
  (req as AuthedRequest).auth = { mode: 'agent', userId: '' };
  next();
}

/**
 * Browser: Supabase session JWT as Bearer.
 * Agent / scripts: same secret as `requireAgentSecret` (impersonates body userId).
 */
export function requireUserOrAgent(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const token = getBearer(req);
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization Bearer token' });
    return;
  }

  const agentSecret = process.env.RECALL_AGENT_SECRET?.trim();
  if (agentSecret && token === agentSecret) {
    req.auth = { mode: 'agent', userId: '' };
    next();
    return;
  }

  void supabase.auth.getUser(token).then(({ data: { user }, error }) => {
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }
    req.auth = { mode: 'user', userId: user.id };
    next();
  });
}

export function assertTargetUser(req: AuthedRequest, targetUserId: string | undefined): boolean {
  if (!targetUserId) return false;
  if (req.auth?.mode === 'agent') return true;
  if (req.auth?.mode === 'user' && req.auth.userId === targetUserId) return true;
  return false;
}
