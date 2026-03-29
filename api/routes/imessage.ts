import { Router, type Request, type Response } from 'express';
import { describeAgentWsStatus, sendScanCancelToAgent, sendScanToAgent } from '../services/location.js';

type ScanStatus = 'idle' | 'scanning' | 'done' | 'error' | 'cancelled';

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

  scanStates.set(userId, {
    status: 'scanning',
    startedAt: new Date().toISOString(),
    progress: {
      currentChat: 'Connecting to Mac agent…',
      chatsDone: 0,
      chatsTotal: 0,
      ingested: 0,
      skippedEmpty: 0,
      failed: 0,
      log: [],
    },
  });

  const sent = sendScanToAgent(userId);
  if (!sent) {
    const dbg = describeAgentWsStatus(userId);
    const error =
      'No Mac iMessage agent connected. On the Mac where Messages lives, run `npm run dev` and keep the `agent` process running (Photon + Full Disk Access). The agent uses a shared local connection — you do not need to edit UUIDs in `.env` when a different person logs into Recall. If `SECOND_BRAIN_API_URL` points at production, add `SECOND_BRAIN_WS_URL=ws://127.0.0.1:3001`.';
    scanStates.set(userId, { status: 'error', errorMessage: error });
    res.status(503).json({ error, status: 'error', debug: dbg });
    return;
  }

  res.json({ ok: true, status: 'scanning' });
});

/** POST /api/imessage/scan-cancel — ask the Mac agent to stop the current scan */
router.post('/imessage/scan-cancel', (req: Request, res: Response) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const existing = scanStates.get(userId);
  if (!existing || existing.status !== 'scanning') {
    res.json({ ok: true, noop: true });
    return;
  }

  const sent = sendScanCancelToAgent(userId);
  if (!sent) {
    res.status(503).json({ error: 'Agent not connected — cannot send stop signal.' });
    return;
  }

  res.json({ ok: true });
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
  const { userId, success, result, error, cancelled } = req.body as {
    userId?: string;
    success?: boolean;
    result?: { scanned: number; ingested: number; skippedEmpty: number; failed: number };
    error?: string;
    cancelled?: boolean;
  };

  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const existing = scanStates.get(userId);
  const terminal: ScanStatus =
    success && cancelled ? 'cancelled' : success ? 'done' : 'error';
  scanStates.set(userId, {
    status: terminal,
    completedAt: new Date().toISOString(),
    result,
    errorMessage: error,
    progress: existing?.progress, // keep last progress for reference
  });

  res.json({ ok: true });
});

export default router;
