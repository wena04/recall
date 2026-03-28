import { Router, type Request, type Response } from 'express';
import { broadcastToUser } from '../services/location.js';

type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

interface ScanProgress {
  currentChat: string;
  chatsDone: number;
  chatsTotal: number;
  ingested: number;
  skippedEmpty: number;
  failed: number;
  log: string[]; // last 20 events
}

interface ScanState {
  status: ScanStatus;
  startedAt?: string;
  completedAt?: string;
  result?: { scanned: number; ingested: number; skippedEmpty: number; failed: number };
  errorMessage?: string;
  progress?: ScanProgress;
}

const scanStates = new Map<string, ScanState>();

const router = Router();

/** POST /api/imessage/scan-trigger — tell the local Photon agent to scan all chats */
router.post('/imessage/scan-trigger', (req: Request, res: Response) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  scanStates.set(userId, { status: 'scanning', startedAt: new Date().toISOString() });

  const sent = broadcastToUser(userId, { type: 'scan_all' });
  if (!sent) {
    scanStates.set(userId, {
      status: 'error',
      errorMessage: 'Agent not connected — is `npm run agent:start` running?',
    });
    res.status(503).json({
      error: 'Agent not connected — is `npm run agent:start` running?',
      status: 'error',
    });
    return;
  }

  res.json({ ok: true, status: 'scanning' });
});

/** GET /api/imessage/scan-status?userId= — poll scan progress from the Connect page */
router.get('/imessage/scan-status', (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    res.status(400).json({ error: 'userId query param is required' });
    return;
  }

  const state = scanStates.get(userId);
  res.json({ status: state?.status ?? 'idle', ...state });
});

/** POST /api/imessage/scan-progress — live progress update from agent during scan */
router.post('/imessage/scan-progress', (req: Request, res: Response) => {
  const { userId, progress } = req.body as {
    userId?: string;
    progress?: Omit<ScanProgress, 'log'> & { event?: string };
  };

  if (!userId || !progress) {
    res.status(400).json({ error: 'userId and progress are required' });
    return;
  }

  const existing = scanStates.get(userId);
  if (!existing || existing.status !== 'scanning') {
    res.json({ ok: true }); // ignore stale updates
    return;
  }

  const prevLog = existing.progress?.log ?? [];
  const newEntry = progress.event ?? null;
  const log = newEntry
    ? [...prevLog, newEntry].slice(-20) // keep last 20 lines
    : prevLog;

  scanStates.set(userId, {
    ...existing,
    progress: {
      currentChat: progress.currentChat,
      chatsDone: progress.chatsDone,
      chatsTotal: progress.chatsTotal,
      ingested: progress.ingested,
      skippedEmpty: progress.skippedEmpty,
      failed: progress.failed,
      log,
    },
  });

  res.json({ ok: true });
});

/** POST /api/imessage/scan-complete — called by the agent after scanAllChatsAndIngest finishes */
router.post('/imessage/scan-complete', (req: Request, res: Response) => {
  const { userId, success, result, error } = req.body as {
    userId?: string;
    success?: boolean;
    result?: { scanned: number; ingested: number; skippedEmpty: number; failed: number };
    error?: string;
  };

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const existing = scanStates.get(userId);
  scanStates.set(userId, {
    status: success ? 'done' : 'error',
    completedAt: new Date().toISOString(),
    result,
    errorMessage: error,
    progress: existing?.progress, // keep last progress for reference
  });

  res.json({ ok: true });
});

export default router;
