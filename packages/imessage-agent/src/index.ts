import 'dotenv/config';
import { IMessageSDK } from '@photon-ai/imessage-kit';
import { formatRecallImessageReply, processRecall } from './ai-stub.js';
import { ingestTranscriptToSecondBrain } from './ingest-api.js';

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

// ─── Init ────────────────────────────────────────────────
const sdk = new IMessageSDK({ debug: true });

const chatLabelById = new Map<string, string>();

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
async function handleMessage(message: any, isGroup: boolean) {
  const text = (message.text || '').toLowerCase().trim();
  if (!text.includes(TRIGGER)) return;

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

// ─── Watch ───────────────────────────────────────────────
await sdk.startWatching({
  onDirectMessage: (msg: any) => handleMessage(msg, false),
  onGroupMessage: (msg: any) => handleMessage(msg, true),
});

console.log('🟢 Recall is live!');
console.log(`   "${TRIGGER}"       → summarize + save (if ingest on)`);
console.log(`   "${TRIGGER} quick" → shorter iMessage reply`);
console.log('   Ctrl+C to stop\n');

process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  await sdk.close();
  process.exit(0);
});
