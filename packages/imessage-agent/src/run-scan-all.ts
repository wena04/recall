/**
 * Background / CLI: multi-chat ingest (same as iMessage "recall all").
 * Run on macOS with Full Disk Access; API must be up (`npm run dev` at repo root).
 *
 *   npm run agent:scan-all
 *
 * Env: SECOND_BRAIN_API_URL, SECOND_BRAIN_USER_ID, optional RECALL_MAX_CHATS_SCAN, etc.
 */
import './load-agent-env.js';
import { IMessageSDK } from '@photon-ai/imessage-kit';
import { scanAllChatsAndIngest } from './scan-all-chats.js';

const RECALL_MAX_CHATS_SCAN = parseInt(process.env.RECALL_MAX_CHATS_SCAN || '15', 10);
const RECALL_MESSAGES_PER_CHAT_SCAN = parseInt(process.env.RECALL_MESSAGES_PER_CHAT_SCAN || '120', 10);
const RECALL_INGEST_DELAY_MS = parseInt(process.env.RECALL_INGEST_DELAY_MS || '1500', 10);
const RECALL_DEMO_HINT = process.env.RECALL_DEMO_HINT?.trim() || '';

async function main() {
  const base = process.env.SECOND_BRAIN_API_URL?.replace(/\/$/, '');
  const userId = process.env.SECOND_BRAIN_USER_ID;
  if (!base || !userId) {
    console.error(
      'Missing SECOND_BRAIN_API_URL or SECOND_BRAIN_USER_ID. Set them in packages/imessage-agent/.env (or repo root .env).',
    );
    process.exit(1);
  }

  const scanDebug =
    process.env.RECALL_SCAN_DEBUG?.trim().toLowerCase() === '1' ||
    process.env.RECALL_SCAN_DEBUG?.trim().toLowerCase() === 'true';

  console.log('🧠 scan-all (CLI)');
  console.log(`   API: ${base}`);
  console.log(`   Max chats: ${RECALL_MAX_CHATS_SCAN}, messages/chat: ${RECALL_MESSAGES_PER_CHAT_SCAN}, delay: ${RECALL_INGEST_DELAY_MS}ms`);
  console.log(`   Debug: ${scanDebug ? 'RECALL_SCAN_DEBUG on (per-thread logs)' : 'off (set RECALL_SCAN_DEBUG=true for details)'}`);
  if (process.env.RECALL_GROUP_NAME_CONTAINS?.trim()) {
    console.log(`   Group name filter: ${process.env.RECALL_GROUP_NAME_CONTAINS}`);
  } else {
    console.log('   Group name filter: (none — all matching threads)');
  }

  const sdk = new IMessageSDK({ debug: false });
  try {
    const result = await scanAllChatsAndIngest(sdk, {
      maxChats: RECALL_MAX_CHATS_SCAN,
      messagesPerChat: RECALL_MESSAGES_PER_CHAT_SCAN,
      delayMs: RECALL_INGEST_DELAY_MS,
      demoHint: RECALL_DEMO_HINT || undefined,
    });
    console.log('\n✅ Done');
    console.log(`   Scanned: ${result.scanned}, ingested: ${result.ingested}, empty: ${result.skippedEmpty}, failed: ${result.failed}`);
    if (result.errors.length > 0) {
      console.log('   Errors (first 10):');
      result.errors.slice(0, 10).forEach((e) => console.log('   -', e));
    }
    process.exit(result.failed > 0 && result.ingested === 0 ? 1 : 0);
  } finally {
    await sdk.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
