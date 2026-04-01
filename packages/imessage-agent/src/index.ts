import 'dotenv/config';
import { recallAgentHeaders } from './agent-auth-headers.js';
import { IMessageSDK } from '@photon-ai/imessage-kit';
import { formatMirrorMemoryReply, processRecall, formatSelfNotification } from './ai-stub.js';
import { ingestTranscriptToSecondBrain, queryMirrorMemory } from './ingest-api.js';
import { scanAllChatsAndIngest } from './scan-all-chats.js';
import WebSocket from 'ws';

// ─── Config ──────────────────────────────────────────────
const TRIGGER = (process.env.RECALL_TRIGGER || 'recall').toLowerCase();
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES || '400', 10);
const INGEST_BEFORE_RECALL =
  process.env.SECOND_BRAIN_INGEST_ON_RECALL === '1' ||
  process.env.SECOND_BRAIN_INGEST_ON_RECALL === 'true';

/** Comma-separated substrings; if set, only matching *group* chats trigger recall (e.g. INFO 340,INFO 330) */
const RECALL_GROUP_NAME_CONTAINS = process.env.RECALL_GROUP_NAME_CONTAINS?.trim() || '';
const GROUP_PATTERNS = RECALL_GROUP_NAME_CONTAINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Prepended to MiniMax as ingest_note (e.g. "USC INFO 340 group project demo") */
const RECALL_DEMO_HINT = process.env.RECALL_DEMO_HINT?.trim() || '';

const CHAT_LABEL_REFRESH_MS = parseInt(process.env.CHAT_LABEL_REFRESH_MS || '300000', 10);

/** `recall all` — scan up to N chats (separate Second Brain rows). Off unless RECALL_SCAN_ALL_CHATS=true */
const RECALL_SCAN_ALL_CHATS =
  process.env.RECALL_SCAN_ALL_CHATS === '1' || process.env.RECALL_SCAN_ALL_CHATS === 'true';
const RECALL_MAX_CHATS_SCAN = parseInt(process.env.RECALL_MAX_CHATS_SCAN || '15', 10);
const RECALL_MESSAGES_PER_CHAT_SCAN = parseInt(process.env.RECALL_MESSAGES_PER_CHAT_SCAN || '120', 10);
const RECALL_INGEST_DELAY_MS = parseInt(process.env.RECALL_INGEST_DELAY_MS || '1500', 10);

/** Append last N thread lines to the Mirror Memory question (helps before chat is ingested + embedded). 0 = off. */
const RECALL_THREAD_CONTEXT_LINES = parseInt(process.env.RECALL_THREAD_CONTEXT_LINES || '25', 10);

// ─── Init ────────────────────────────────────────────────
const sdk = new IMessageSDK({ debug: true });

const chatLabelById = new Map<string, string>();

// Debounce map for auto-ingest on own outgoing messages (chatId → last ingest epoch ms)
const lastIngestedAt = new Map<string, number>();
const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes

function humanizeChatId(chatId: string): string {
  const tail = chatId.includes(';') ? chatId.split(';').slice(1).join(';') : chatId;
  const digits = tail.replace(/\s/g, '');
  if (/^\+?\d{10,15}$/.test(digits)) return digits.startsWith('+') ? digits : `+${digits}`;
  return chatId.length > 36 ? `${chatId.slice(0, 33)}…` : chatId;
}

async function refreshChatLabels(): Promise<void> {
  try {
    const chats = await sdk.listChats({ limit: 5000 });
    chatLabelById.clear();
    for (const c of chats) {
      const label = c.displayName?.trim() || humanizeChatId(c.chatId);
      chatLabelById.set(c.chatId, label);
    }
    console.log(`   📇 Chat label cache: ${chatLabelById.size} threads`);
  } catch (e) {
    console.warn('   ⚠ refreshChatLabels:', e instanceof Error ? e.message : e);
  }
}

function groupMatchesPatterns(chatId: string): boolean {
  if (GROUP_PATTERNS.length === 0) return true;
  const label = (chatLabelById.get(chatId) || '').toLowerCase();
  return GROUP_PATTERNS.some((p) => label.includes(p.toLowerCase()));
}

console.log('🧠 Recall Agent starting...');
console.log(`   Trigger: "${TRIGGER}"`);
console.log(`   Max messages (per recall): ${MAX_MESSAGES}`);
console.log(
  `   Thread → DB ingest (background on recall): ${INGEST_BEFORE_RECALL ? 'ON' : 'off'}`,
);
console.log(
  `   Mirror Memory: POST /api/query · thread context lines: ${RECALL_THREAD_CONTEXT_LINES || 'off'}`,
);
if (GROUP_PATTERNS.length > 0) {
  console.log(`   Group filter (groups only): contains one of → ${GROUP_PATTERNS.join(' | ')}`);
} else {
  console.log('   Group filter: off (any DM/group can trigger)');
}
if (RECALL_DEMO_HINT) {
  const h = RECALL_DEMO_HINT;
  console.log(`   Demo hint for MiniMax: ${h.length > 100 ? `${h.slice(0, 100)}…` : h}`);
}
console.log('');
if (
  INGEST_BEFORE_RECALL &&
  (!process.env.SECOND_BRAIN_API_URL || !process.env.SECOND_BRAIN_USER_ID)
) {
  console.warn(
    '   ⚠ Set SECOND_BRAIN_API_URL and SECOND_BRAIN_USER_ID or ingest will be skipped each recall.\n',
  );
}

await refreshChatLabels();
setInterval(refreshChatLabels, CHAT_LABEL_REFRESH_MS);

/** Photon accepts phone/email or group `chatId` for send() — groups need chatId. */
function replyTarget(message: any): string {
  const m = message ?? {};
  const fromMsg =
    (typeof m.chatId === 'string' && m.chatId.trim()) ||
    (typeof m.chatIdentifier === 'string' && m.chatIdentifier.trim()) ||
    (typeof m.chat_id === 'string' && m.chat_id.trim()) ||
    (typeof m.sender === 'string' && m.sender.trim()) ||
    '';
  if (fromMsg) return fromMsg;
  // Self-DM / some Photon builds omit chatId+sender on outgoing bubbles — set phone or `iMessage;+1…` id.
  return (process.env.RECALL_REPLY_FALLBACK || '').trim();
}

function runHandleMessage(msg: any, isGroup: boolean) {
  void handleMessage(msg, isGroup).catch((err) => {
    console.error('   ❌ handleMessage failed:', err);
  });
}

/**
 * Outbound copy we generate often contains the word "recall" (headers, location pings).
 * In group / @Recall flows those messages can arrive as normal `onGroupMessage` events — they must NOT
 * re-trigger `handleMessage` or you get an infinite loop. Match **first line only** so a user can
 * still write e.g. "🧠 recall my notes" on line 2+ (we only skip known canned first lines).
 */
function isOurAutomatedMessage(raw: string): boolean {
  const first = raw.trim().split(/\r?\n/)[0] ?? '';
  if (!first) return false;
  if (/^🧠\s*recalling/i.test(first)) return true;
  if (/^🧠\s*scanning/i.test(first)) return true;
  if (/^🧠\s*multi-chat/i.test(first)) return true;
  if (/^🧠\s*recall\s*$/i.test(first)) return true;
  if (/^🧠\s*memory\s*$/i.test(first)) return true;
  if (/^🧠\s*mirror\s+memory/i.test(first)) return true;
  if (/^🧠\s*quick\s+recall\b/i.test(first)) return true;
  if (/^🧠\s*recall\s*\(offline/i.test(first)) return true;
  if (/^✅\s*(multi-chat|scanning)/i.test(first)) return true;
  if (/^⚠️/.test(first)) return true;
  if (/^😅\s*(scan failed|something went wrong)/i.test(first)) return true;
  if (/^📍\s*recall\b/i.test(first)) return true;
  if (/^✦\s*saved to brain/i.test(first)) return true;
  return false;
}

/** Only treat as a command if "recall" appears near the start — LLM summaries often mention "recall" in the body. */
const RECALL_TRIGGER_HEAD_CHARS = 520;

function isRecallTriggerText(raw: string): boolean {
  if (isOurAutomatedMessage(raw)) return false;
  const lower = raw.toLowerCase().trim();
  const head = lower.slice(0, RECALL_TRIGGER_HEAD_CHARS);
  // Avoid matching "recallable"; still matches "@recall", "recall quick", "recall all"
  return /\brecall\b/.test(head);
}

/**
 * Strip trigger / @Recall and return the Mirror Memory question (same pipeline as Dashboard).
 */
function extractRecallQuestion(raw: string): { question: string; quick: boolean } {
  const quick = /\b(recall\s+(quick|tldr)|quick\s+recall)\b/i.test(raw);
  let s = raw.replace(/@\s*recall\b/gi, ' ').trim();
  s = s.replace(/\brecall\s+(quick|tldr)\b/gi, ' ').replace(/\bquick\s+recall\b/gi, ' ');
  s = s.replace(/\brecall\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  const defaultQ =
    'What from my saved memories should I have top of mind right now—places, plans, people, or open threads? Answer concisely as Mirror Memory, in my voice.';
  let question = s.length > 0 ? s : defaultQ;
  if (quick) question += ' Keep the answer brief (under 120 words).';
  return { question, quick };
}

function appendThreadContext(
  question: string,
  chatLabel: string,
  transcriptLines: string[],
): string {
  if (RECALL_THREAD_CONTEXT_LINES <= 0 || transcriptLines.length === 0) return question;
  const slice = transcriptLines.slice(-RECALL_THREAD_CONTEXT_LINES);
  return [
    question,
    '',
    '---',
    `Recent iMessage context from thread "${chatLabel}" (may not be in the database yet):`,
    ...slice,
  ].join('\n');
}

// ─── Core Handler ────────────────────────────────────────
const RECALL_ALL_RE = /\brecall\s+all\b/;

async function handleMessage(message: any, isGroup: boolean) {
  const rawText = String(message.text ?? '').trim();
  if (!isRecallTriggerText(rawText)) return;
  const text = rawText.toLowerCase();

  /** Multi-chat ingest: one API row per thread → multiple categories possible across DB. */
  if (RECALL_ALL_RE.test(text)) {
    const toAll = replyTarget(message);
    if (!toAll) {
      console.error(
        '   ❌ recall all: no send target (chatId/sender). Set RECALL_REPLY_FALLBACK in .env. Keys:',
        Object.keys(message ?? {}),
      );
      return;
    }
    if (!RECALL_SCAN_ALL_CHATS) {
      await sdk.send(
        toAll,
        '🧠 Multi-chat scan is off. Set RECALL_SCAN_ALL_CHATS=true in packages/imessage-agent/.env, then say "recall all" again.',
      );
      return;
    }
    if (
      !INGEST_BEFORE_RECALL ||
      !process.env.SECOND_BRAIN_API_URL ||
      !process.env.SECOND_BRAIN_USER_ID
    ) {
      await sdk.send(
        toAll,
        '⚠️ Enable SECOND_BRAIN_INGEST_ON_RECALL + SECOND_BRAIN_API_URL + SECOND_BRAIN_USER_ID for multi-chat ingest.',
      );
      return;
    }
    const to = toAll;
    await sdk.send(to, `🧠 Scanning up to ${RECALL_MAX_CHATS_SCAN} chats (this may take a few minutes)...`);
    try {
      const result = await scanAllChatsAndIngest(sdk, {
        maxChats: RECALL_MAX_CHATS_SCAN,
        messagesPerChat: RECALL_MESSAGES_PER_CHAT_SCAN,
        delayMs: RECALL_INGEST_DELAY_MS,
        demoHint: RECALL_DEMO_HINT || undefined,
      });
      const errTail =
        result.errors.length > 0 ? `\n\nErrors (first 3):\n${result.errors.slice(0, 3).join('\n')}` : '';
      await sdk.send(
        to,
        [
          '✅ Multi-chat ingest done',
          `Scanned: ${result.scanned} threads`,
          `Saved to Second Brain: ${result.ingested}`,
          `Skipped empty: ${result.skippedEmpty} · Failed: ${result.failed}`,
          errTail,
        ].join('\n'),
      );
    } catch (e) {
      await sdk.send(
        to,
        `😅 Scan failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return;
  }

  // When set, only *group* threads whose display name matches respond; DMs (incl. self-chat) still work.
  if (GROUP_PATTERNS.length > 0 && isGroup) {
    if (!message.chatId) return;
    if (!groupMatchesPatterns(message.chatId)) {
      await refreshChatLabels();
      if (!groupMatchesPatterns(message.chatId)) return;
    }
  }

  const sender = message.sender || 'unknown';
  const to = replyTarget(message);
  if (!to) {
    console.error(
      '   ❌ No iMessage send target (chatId/sender). For self-chat, set RECALL_REPLY_FALLBACK to your number or chat id. Keys:',
      Object.keys(message ?? {}),
    );
    return;
  }
  const chatType = isGroup ? 'Group' : 'DM';
  const idForLabel = message.chatId || to;
  const chatLabel = idForLabel
    ? chatLabelById.get(idForLabel) || humanizeChatId(idForLabel)
    : humanizeChatId(to);

  console.log(`\n📩 [${chatType}] Recall triggered by ${sender} · ${chatLabel}`);

  try {
    try {
      await sdk.send(to, "🧠 Recalling... give me a sec");
    } catch (e: any) {
      console.warn("   ⚠️ Could not send 'Recalling' confirmation:", e.message);
    }

    if (!message.chatId && !message.chatIdentifier) {
      console.warn(
        '   ⚠ No chatId on Photon event — scoping history with resolved send target (self-DM often needs RECALL_REPLY_FALLBACK).',
      );
    }
    const history = await sdk.getMessages({
      ...(to ? { chatId: to } : {}),
      limit: MAX_MESSAGES,
      excludeOwnMessages: false,
      excludeReactions: true,
    });
    const messages = (history.messages || [])
      .filter((m: any) => m.text && m.text.length > 0)
      .map((m: any) => ({
        sender: m.sender || 'Unknown',
        text: m.text,
        date: m.date,
      }));

    console.log(`   📊 ${messages.length} messages fetched`);

    const lines =
      messages.length === 0
        ? []
        : messages.map(
            (m: { sender: string; text: string; date?: string }) =>
              `[${m.date ?? '?'}] ${m.sender}: ${m.text}`,
          );

    const { question: baseQuestion, quick: isQuick } = extractRecallQuestion(rawText);
    const ingestNoteParts = [
      `iMessage recall · ${chatType} · ${chatLabel}`,
      ...(RECALL_DEMO_HINT ? [RECALL_DEMO_HINT] : []),
    ];

    if (INGEST_BEFORE_RECALL) {
      void ingestTranscriptToSecondBrain(lines, {
        chatLabel,
        photonChatId: message.chatId || to,
        ingestNote: ingestNoteParts.join('\n'),
      }).then((ing) => {
        if (ing.ok && !ing.skipped) console.log('   💾 Background thread ingest queued OK');
        else if (!ing.skipped && !ing.ok) console.warn('   ⚠ Background ingest failed:', ing.error);
      });
    }

    const fullQuestion = appendThreadContext(baseQuestion, chatLabel, lines);

    const mirror = await queryMirrorMemory(fullQuestion);
    let replyText: string;
    if (mirror.ok) {
      console.log('   🪞 Mirror Memory /api/query OK');
      replyText = formatMirrorMemoryReply(mirror.answer, chatLabel);
    } else {
      console.warn('   ⚠ Mirror Memory failed:', mirror.error, '— falling back to offline stub');
      const stub = await processRecall(messages, sender, isQuick);
      replyText = [
        `⚠️ Mirror Memory failed: ${mirror.error}`,
        '',
        'Fix: in `packages/imessage-agent/.env` (or repo root `.env`) set `SECOND_BRAIN_API_URL=http://127.0.0.1:3001` and `SECOND_BRAIN_USER_ID` to your Supabase user id (Connect page → copy). Run `npm run dev` so the API is up on that port.',
        '',
        stub,
      ].join('\n');
    }

    await sdk.send(to, replyText);
    console.log('   ✅ Done');
  } catch (error) {
    console.error('   ❌ Error:', error);
    const fallback = replyTarget(message);
    if (fallback) await sdk.send(fallback, '😅 Something went wrong. Try again?');
  }
}

// ─── WebSocket-triggered scan (from Connect page) ────────
let scanAbortRequested = false;

async function handleScanAll(scanUserId?: string): Promise<void> {
  console.log('\n📡 Received scan_all from backend — starting full chat scan...');
  const base = process.env.SECOND_BRAIN_API_URL?.replace(/\/$/, '');
  const userId = (scanUserId && String(scanUserId).trim()) || process.env.SECOND_BRAIN_USER_ID;
  if (!base || !userId) {
    console.warn('   ⚠ scan_all: SECOND_BRAIN_API_URL or userId missing, aborting');
    return;
  }
  scanAbortRequested = false;
  try {
    const result = await scanAllChatsAndIngest(sdk, {
      maxChats: RECALL_MAX_CHATS_SCAN,
      messagesPerChat: RECALL_MESSAGES_PER_CHAT_SCAN,
      delayMs: RECALL_INGEST_DELAY_MS,
      demoHint: RECALL_DEMO_HINT || undefined,
      userId,
      shouldAbort: () => scanAbortRequested,
      onProgress: (p) => {
        fetch(`${base}/api/imessage/scan-progress`, {
          method: 'POST',
          headers: recallAgentHeaders(),
          body: JSON.stringify({ userId, progress: p }),
        }).catch(() => {}); // fire-and-forget, don't block scan
      },
    });
    await fetch(`${base}/api/imessage/scan-complete`, {
      method: 'POST',
      headers: recallAgentHeaders(),
      body: JSON.stringify({
        userId,
        success: true,
        cancelled: !!result.cancelled,
        result: {
          scanned: result.scanned,
          ingested: result.ingested,
          skippedEmpty: result.skippedEmpty,
          failed: result.failed,
        },
      }),
    });
    console.log(
      result.cancelled
        ? `   ⏹ scan stopped early: ${result.ingested} ingested / ${result.scanned} scanned`
        : `   ✅ scan_all complete: ${result.ingested} ingested, ${result.skippedEmpty} skipped-empty, ${result.failed} failed / ${result.scanned} scanned`,
    );
    if (result.errors.length > 0) console.warn('   Errors:', result.errors.slice(0, 5));
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('   ❌ scan_all failed:', error);
    try {
      await fetch(`${base}/api/imessage/scan-complete`, {
        method: 'POST',
        headers: recallAgentHeaders(),
        body: JSON.stringify({ userId, success: false, error }),
      });
    } catch { /* ignore — backend may be down */ }
  }
}

// ─── Auto-ingest on own outgoing messages ────────────────
async function handleOwnMessage(message: any): Promise<void> {
  const chatId: string = message.chatId || '';
  if (!chatId) return;

  const raw = String(message.text ?? '').trim();
  // Our bot replies are "own" messages in some setups; never auto-ingest them.
  if (isOurAutomatedMessage(raw)) return;

  // Debounce — skip if same chat was ingested recently
  const last = lastIngestedAt.get(chatId) ?? 0;
  if (Date.now() - last < DEBOUNCE_MS) return;
  lastIngestedAt.set(chatId, Date.now());

  const base = process.env.SECOND_BRAIN_API_URL?.replace(/\/$/, '');
  const userId = process.env.SECOND_BRAIN_USER_ID;
  if (!base || !userId) return;

  const chatLabel = chatLabelById.get(chatId) || humanizeChatId(chatId);
  console.log(`\n📤 Own message detected in "${chatLabel}" — auto-ingesting`);

  try {
    const history = await sdk.getMessages({
      chatId,
      limit: 40,
      excludeOwnMessages: false,
      excludeReactions: true,
    });
    const getText = (m: any): string =>
      String(m.text ?? m.body ?? m.content ?? m.message ?? '').trim();
    const lines = (history.messages || [])
      .map((m: any) => { const t = getText(m); return t ? `[${m.date ?? '?'}] ${m.sender || 'Me'}: ${t}` : null; })
      .filter((l): l is string => l !== null);

    if (lines.length === 0) return;

    const ing = await ingestTranscriptToSecondBrain(lines, {
      chatLabel,
      photonChatId: chatId,
      ingestNote: 'Source: auto-ingest on own outgoing message.',
    });

    if (ing.ok && !ing.skipped && ing.data?.summary) {
      const target = process.env.RECALL_IMESSAGE_TARGET || '';
      if (target) {
        const confirmText = formatSelfNotification(ing.data.summary, ing.data.category);
        await sdk.send(target, confirmText);
      }
      console.log(`   ✅ Auto-ingest done for "${chatLabel}"`);
    }
  } catch (e) {
    console.error('   ❌ handleOwnMessage error:', e instanceof Error ? e.message : e);
  }
}

// ─── Backend WebSocket (auto-reconnect) ──────────────────
const WS_RECONNECT_MS = 5000;

/**
 * WebSocket registers this Mac as the shared iMessage scanner (`?agent=imessage`).
 * The logged-in user id is sent in each `scan_all` message — no per-user UUID in .env for Connect.
 */
function withAgentQuery(u: URL): string {
  u.searchParams.set('agent', 'imessage');
  return u.toString();
}

function buildAgentWebSocketUrl(): string | null {
  const wsExplicit = process.env.SECOND_BRAIN_WS_URL?.trim();
  if (wsExplicit) {
    try {
      const u = new URL(/^\w+:\/\//.test(wsExplicit) ? wsExplicit : `ws://${wsExplicit}`);
      return withAgentQuery(u);
    } catch {
      console.warn('⚠  SECOND_BRAIN_WS_URL is invalid:', wsExplicit);
      return null;
    }
  }

  const apiRaw = process.env.SECOND_BRAIN_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
  try {
    const httpUrl = new URL(apiRaw);
    const local = httpUrl.hostname === 'localhost' || httpUrl.hostname === '127.0.0.1';
    if (local) {
      httpUrl.protocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      httpUrl.search = '';
      return withAgentQuery(httpUrl);
    }
  } catch {
    /* fall through */
  }

  const port = process.env.SECOND_BRAIN_LOCAL_API_PORT?.trim() || '3001';
  const u = new URL(`ws://127.0.0.1:${port}`);
  console.warn(
    `⚠  SECOND_BRAIN_API_URL is not localhost — WebSocket default ${u.origin}?agent=imessage (set SECOND_BRAIN_WS_URL to override).`,
  );
  return withAgentQuery(u);
}

function connectBackendWs(): void {
  const url = buildAgentWebSocketUrl();
  if (!url) return;

  const ws = new WebSocket(url);

  ws.on('open', () => {
    console.log('🟢 Connected to backend (local iMessage agent)', url);
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'notification') {
        console.log('📬 Received notification:', message.message);
        sdk.send(process.env.RECALL_IMESSAGE_TARGET || '', message.message);
      } else if (message.type === 'scan_all') {
        const uid = typeof message.userId === 'string' && message.userId.trim() ? message.userId.trim() : undefined;
        handleScanAll(uid); // fire-and-forget
      } else if (message.type === 'scan_cancel') {
        scanAbortRequested = true;
        console.log('📩 scan_cancel — stopping after current chat (if a scan is running)');
      }
    } catch (error) {
      console.error('Error parsing message from backend:', error);
    }
  });

  ws.on('close', () => {
    console.log(`🔴 Disconnected from backend — retrying in ${WS_RECONNECT_MS / 1000}s...`);
    setTimeout(connectBackendWs, WS_RECONNECT_MS);
  });

  ws.on('error', (err) => {
    // 'close' fires after 'error', so reconnect is handled there
    console.warn(`⚠ Backend WS error: ${err.message}`);
  });
}

/** Same race as notify-poll: agent starts with `concurrently` before Express binds :3001. */
async function waitForLocalApiHealthBeforeWs(maxMs = 60_000): Promise<void> {
  const raw = process.env.SECOND_BRAIN_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3001';
  let baseUrl: URL;
  try {
    baseUrl = new URL(raw);
  } catch {
    return;
  }
  const host = baseUrl.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return;

  const deadline = Date.now() + maxMs;
  let logged = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${raw}/api/health`);
      if (res.ok) return;
    } catch {
      if (!logged) {
        console.log('   Waiting for local API on :3001 before WebSocket…');
        logged = true;
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.warn('   Local API not ready — WebSocket may error once and retry.');
}

await waitForLocalApiHealthBeforeWs();
connectBackendWs();

// ─── Watch ───────────────────────────────────────────────
// Own messages typically have no sender (null/undefined) or match RECALL_OWN_SENDER.
const OWN_SENDER = (process.env.RECALL_OWN_SENDER || '').toLowerCase();

function isOwnMessage(msg: any): boolean {
  if (!msg.sender) return true;
  if (OWN_SENDER && msg.sender.toLowerCase() === OWN_SENDER) return true;
  return false;
}

await sdk.startWatching({
  onDirectMessage: (msg: any) => {
    const raw = String(msg.text ?? '').trim();
    // Self-chat / your outgoing messages: Photon marks these as "own" — still allow explicit recall.
    if (isOwnMessage(msg)) {
      if (isRecallTriggerText(raw)) {
        runHandleMessage(msg, false);
        return;
      }
      void handleOwnMessage(msg);
      return;
    }
    runHandleMessage(msg, false);
  },
  onGroupMessage: (msg: any) => {
    const raw = String(msg.text ?? '').trim();
    if (isOwnMessage(msg)) {
      if (isRecallTriggerText(raw)) {
        runHandleMessage(msg, true);
        return;
      }
      void handleOwnMessage(msg);
      return;
    }
    runHandleMessage(msg, true);
  },
});

console.log('🟢 Recall is live!');
console.log(`   "${TRIGGER}"       → Mirror Memory (same as Dashboard) + background ingest if on`);
console.log(`   "${TRIGGER} quick" → shorter answer`);
if (RECALL_SCAN_ALL_CHATS) {
  console.log(`   "recall all"       → scan up to ${RECALL_MAX_CHATS_SCAN} chats → one ingest per thread`);
}
console.log('   Ctrl+C to stop\n');

process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  await sdk.close();
  process.exit(0);
});
