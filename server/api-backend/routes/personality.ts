import { Router, type Request, type Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { computePersonality } from '../services/personality.js';

const router = Router();

/** GET /api/personality/:userId — fetch stored profile */
router.get('/personality/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('user_personality')
    .select('profile, computed_at')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }

  res.json({ profile: data?.profile ?? null, computed_at: data?.computed_at ?? null });
});

/**
 * POST /api/personality/compute — SSE stream of progress + final profile.
 *
 * Events:
 *   data: {"type":"progress","message":"..."}
 *   data: {"type":"done","profile":{...}}
 *   data: {"type":"error","message":"..."}
 */
router.post('/personality/compute', async (req: Request, res: Response) => {
  const { userId } = req.body as { userId?: string };

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (payload: object) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const profile = await computePersonality(userId, (message) => {
      send({ type: 'progress', message });
    });
    send({ type: 'done', profile });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('personality/compute:', msg);
    send({ type: 'error', message: msg });
  } finally {
    res.end();
  }
});

export default router;
