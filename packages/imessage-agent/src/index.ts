import 'dotenv/config';
import { IMessageSDK } from '@photon-ai/imessage-kit';
import { formatRecallImessageReply, processRecall, formatSelfNotification } from './ai-stub.js';
import { ingestTranscriptToSecondBrain } from './ingest-api.js';
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
  `   Second Brain ingest: ${INGEST_BEFORE_RECALL ? 'ON (SECOND_BRAIN_INGEST_ON_RECALL)' : 'off'}`,
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
function replyTarget(message: { chatId?: string; sender?: string }): string {
  return message.chatId || message.sender || '';
}

// ─── Core Handler ────────────────────────────────────────
const RECALL_ALL_RE = /\brecall\s+all\b/;

async function handleMessage(message: any, isGroup: boolean) {
  const text = (message.text || '').toLowerCase().trim();
  if (!text.includes(TRIGGER)) return;

  /** Multi-chat ingest: one API row per thread → multiple categories possible across DB. */
  if (RECALL_ALL_RE.test(text)) {
    if (!RECALL_SCAN_ALL_CHATS) {
      await sdk.send(
        replyTarget(message),
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
        replyTarget(message),
        '⚠️ Enable SECOND_BRAIN_INGEST_ON_RECALL + SECOND_BRAIN_API_URL + SECOND_BRAIN_USER_ID for multi-chat ingest.',
      );
      return;
    }
    const to = replyTarget(message);
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

  if (GROUP_PATTERNS.length > 0) {
    if (!isGroup || !message.chatId) return;
    if (!groupMatchesPatterns(message.chatId)) {
      await refreshChatLabels();
      if (!groupMatchesPatterns(message.chatId)) return;
    }
  }

  const sender = message.sender || 'unknown';
  const to = replyTarget(message);
  const chatType = isGroup ? 'Group' : 'DM';
  const chatLabel = message.chatId
    ? chatLabelById.get(message.chatId) || humanizeChatId(message.chatId)
    : humanizeChatId(to);

  console.log(`\n📩 [${chatType}] Recall triggered by ${sender} · ${chatLabel}`);

  try {
    await sdk.send(to, '🧠 Recalling... give me a sec');

    if (!message.chatId) {
      console.warn(
        '   ⚠ No chatId on message — using global recent messages (check Photon SDK version).',
      );
    }
    const history = await sdk.getMessages({
      ...(message.chatId ? { chatId: message.chatId } : {}),
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

    if (messages.length === 0) {
      await sdk.send(to, 'No recent messages found to summarize.');
      return;
    }

    const lines = messages.map(
      (m: { sender: string; text: string; date?: string }) =>
        `[${m.date ?? '?'}] ${m.sender}: ${m.text}`,
    );

    const ingestNoteParts: string[] = [
      'Source: Photon iMessage thread. Extract recall_enrichment (keywords, places, courses_or_projects, texting_style) and persona for participants.',
    ];
    if (RECALL_DEMO_HINT) ingestNoteParts.unshift(RECALL_DEMO_HINT);

    let replyText: string;
    const isQuick = text.includes('quick') || text.includes('tldr');

    if (INGEST_BEFORE_RECALL) {
      const ing = await ingestTranscriptToSecondBrain(lines, {
        chatLabel,
        photonChatId: message.chatId,
        ingestNote: ingestNoteParts.join('\n'),
      });
      if (!ing.skipped && ing.ok && ing.data?.summary) {
        console.log('   💾 MiniMax + Supabase ingest OK');
        replyText = formatRecallImessageReply({
          summary: ing.data.summary,
          category: ing.data.category,
          action_items: ing.data.action_items,
          recall_enrichment: ing.data.recall_enrichment,
          isQuick,
          chatLabel,
        });
      } else if (!ing.skipped && !ing.ok) {
        console.warn('   ⚠ Second Brain ingest failed:', ing.error);
        replyText = await processRecall(messages, sender, isQuick);
      } else {
        replyText = await processRecall(messages, sender, isQuick);
      }
    } else {
      replyText = await processRecall(messages, sender, isQuick);
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
async function handleScanAll(): Promise<void> {
  console.log('\n📡 Received scan_all from backend — starting full chat scan...');
  const base = process.env.SECOND_BRAIN_API_URL?.replace(/\/$/, '');
  const userId = process.env.SECOND_BRAIN_USER_ID;
  if (!base || !userId) {
    console.warn('   ⚠ scan_all: SECOND_BRAIN_API_URL or SECOND_BRAIN_USER_ID not set, aborting');
    return;
  }
  try {
    const result = await scanAllChatsAndIngest(sdk, {
      maxChats: RECALL_MAX_CHATS_SCAN,
      messagesPerChat: RECALL_MESSAGES_PER_CHAT_SCAN,
      delayMs: RECALL_INGEST_DELAY_MS,
      demoHint: RECALL_DEMO_HINT || undefined,
      onProgress: (p) => {
        fetch(`${base}/api/imessage/scan-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, progress: p }),
        }).catch(() => {}); // fire-and-forget, don't block scan
      },
    });
    await fetch(`${base}/api/imessage/scan-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, success: true, result: { scanned: result.scanned, ingested: result.ingested, skippedEmpty: result.skippedEmpty, failed: result.failed } }),
    });
    console.log(`   ✅ scan_all complete: ${result.ingested} ingested, ${result.skippedEmpty} skipped-empty, ${result.failed} failed / ${result.scanned} scanned`);
    if (result.errors.length > 0) console.warn('   Errors:', result.errors.slice(0, 5));
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('   ❌ scan_all failed:', error);
    try {
      await fetch(`${base}/api/imessage/scan-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, success: false, error }),
      });
    } catch { /* ignore — backend may be down */ }
  }
}

// ─── Auto-ingest on own outgoing messages ────────────────
async function handleOwnMessage(message: any): Promise<void> {
  const chatId: string = message.chatId || '';
  if (!chatId) return;

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
const WS_URL = `ws://localhost:3001?userId=${process.env.SECOND_BRAIN_USER_ID}`;
const WS_RECONNECT_MS = 5000;

function connectBackendWs(): void {
  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('🟢 Connected to backend for notifications');
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'notification') {
        console.log('📬 Received notification:', message.message);
        sdk.send(process.env.RECALL_IMESSAGE_TARGET || '', message.message);
      } else if (message.type === 'scan_all') {
        handleScanAll(); // fire-and-forget
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
    if (isOwnMessage(msg)) { handleOwnMessage(msg); return; }
    handleMessage(msg, false);
  },
  onGroupMessage: (msg: any) => {
    if (isOwnMessage(msg)) { handleOwnMessage(msg); return; }
    handleMessage(msg, true);
  },
});

console.log('🟢 Recall is live!');
console.log(`   "${TRIGGER}"       → summarize + save (if ingest on)`);
console.log(`   "${TRIGGER} quick" → shorter iMessage reply`);
if (RECALL_SCAN_ALL_CHATS) {
  console.log(`   "recall all"       → scan up to ${RECALL_MAX_CHATS_SCAN} chats → one ingest per thread`);
}
console.log('   Ctrl+C to stop\n');

process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  await sdk.close();
  process.exit(0);
});
