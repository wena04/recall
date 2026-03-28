/**
 * Optional: ingest multiple chats as separate Second Brain rows (one MiniMax pass per chat).
 * Gives category variety across threads instead of one mega-transcript row.
 */

import type { IMessageSDK } from '@photon-ai/imessage-kit';
import { ingestTranscriptToSecondBrain } from './ingest-api.js';

function humanizeChatId(chatId: string): string {
  const tail = chatId.includes(';') ? chatId.split(';').slice(1).join(';') : chatId;
  const digits = tail.replace(/\s/g, '');
  if (/^\+?\d{10,15}$/.test(digits)) return digits.startsWith('+') ? digits : `+${digits}`;
  return chatId.length > 36 ? `${chatId.slice(0, 33)}…` : chatId;
}

function parseGroupPatterns(): string[] {
  const raw = process.env.RECALL_GROUP_NAME_CONTAINS?.trim() || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function scanDebugEnabled(): boolean {
  const v = process.env.RECALL_SCAN_DEBUG?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export interface ScanAllChatsProgress {
  currentChat: string;
  chatsDone: number;
  chatsTotal: number;
  ingested: number;
  skippedEmpty: number;
  failed: number;
  event?: string;
}

export interface ScanAllChatsOptions {
  maxChats: number;
  messagesPerChat: number;
  delayMs: number;
  demoHint?: string;
  onProgress?: (p: ScanAllChatsProgress) => void | Promise<void>;
}

export interface ScanAllChatsResult {
  scanned: number;
  ingested: number;
  skippedEmpty: number;
  failed: number;
  errors: string[];
}

export async function scanAllChatsAndIngest(
  sdk: IMessageSDK,
  opts: ScanAllChatsOptions,
): Promise<ScanAllChatsResult> {
  const debug = scanDebugEnabled();
  const patterns = parseGroupPatterns();
  const errors: string[] = [];
  let ingested = 0;
  let skippedEmpty = 0;
  let failed = 0;

  // Fetch all messages from the last 90 days in one shot.
  // This avoids the listChats→getMessages({chatId}) bug where the SDK builds
  // chatIds with a service prefix (e.g. "iMessage;+1234") that doesn't match
  // the raw chat_identifier in the SQLite DB, causing every per-chat fetch to
  // return 0 results.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const totalLimit = Math.min(opts.maxChats * opts.messagesPerChat, 30000);

  if (debug) {
    console.log(`[scan-debug] Fetching up to ${totalLimit} messages since ${since.toDateString()}...`);
  }

  const { messages: allMessages } = await sdk.getMessages({
    since,
    limit: totalLimit,
    excludeOwnMessages: false,
    excludeReactions: true,
  });

  if (debug) {
    console.log(`[scan-debug] Total messages fetched: ${allMessages.length}`);
  }

  // Group by chatId (= chat_identifier from DB — always correct here)
  const chatGroups = new Map<string, typeof allMessages[number][]>();
  for (const msg of allMessages) {
    const key = msg.chatId || '__unknown__';
    if (!chatGroups.has(key)) chatGroups.set(key, []);
    chatGroups.get(key)!.push(msg);
  }

  // Sort groups by most recent message, apply maxChats cap
  const sortedGroups = [...chatGroups.entries()]
    .sort(([, a], [, b]) => {
      const ta = a[0] ? (typeof a[0].date === 'string' ? new Date(a[0].date).getTime() : Number(a[0].date) || 0) : 0;
      const tb = b[0] ? (typeof b[0].date === 'string' ? new Date(b[0].date).getTime() : Number(b[0].date) || 0) : 0;
      return tb - ta;
    })
    .filter(([chatId]) => {
      if (chatId === '__unknown__') return false;
      if (patterns.length === 0) return true;
      const label = humanizeChatId(chatId).toLowerCase();
      return patterns.some((p) => label.includes(p.toLowerCase()));
    })
    .slice(0, opts.maxChats);

  if (debug) {
    console.log(`[scan-debug] Unique chats to process: ${sortedGroups.length}`);
  }

  const chatsTotal = sortedGroups.length;

  // Helper to fire progress callback without blocking the scan loop
  const reportProgress = (currentChat: string, chatsDone: number, event?: string) => {
    opts.onProgress?.({ currentChat, chatsDone, chatsTotal, ingested, skippedEmpty, failed, event });
  };

  const ingestNoteParts: string[] = [
    'Source: Photon multi-chat scan (one thread per ingest). Extract recall_enrichment and persona when applicable.',
  ];
  if (opts.demoHint) ingestNoteParts.unshift(opts.demoHint);

  let scanned = 0;
  for (const [chatId, msgs] of sortedGroups) {
    scanned += 1;
    const label = humanizeChatId(chatId);
    reportProgress(label, scanned - 1, `Scanning ${label}…`);
    try {
      // Take the most recent messagesPerChat messages and build transcript lines
      const recent = msgs.slice(0, opts.messagesPerChat);
      const lines = recent
        .map((m: any) => {
          const t = String(m.text ?? '').trim();
          if (!t) return null;
          const who = m.senderName || m.sender || 'Me';
          return `[${m.date ?? '?'}] ${who}: ${t}`;
        })
        .filter((l): l is string => l !== null);

      if (debug) {
        console.log(
          `[scan-debug] #${scanned} "${label}" — ${recent.length} msgs, ${lines.length} with text` +
          (lines[0] ? `\n           preview: ${lines[0].slice(0, 80)}` : ''),
        );
      }

      if (lines.length === 0) {
        skippedEmpty += 1;
        reportProgress(label, scanned, `Skipped ${label} (no text)`);
        if (debug) console.log(`           → skip (no text messages)`);
        continue;
      }

      const ing = await ingestTranscriptToSecondBrain(lines, {
        chatLabel: label,
        photonChatId: chatId,
        ingestNote: ingestNoteParts.join('\n'),
      });

      if (ing.skipped) {
        skippedEmpty += 1;
        reportProgress(label, scanned, `Skipped ${label} (env missing)`);
        if (debug) console.log(`           → skip (SECOND_BRAIN_* env missing)`);
        continue;
      }
      if (ing.ok) {
        ingested += 1;
        const summary = ing.data?.summary ? ` — ${ing.data.summary.slice(0, 60)}` : '';
        reportProgress(label, scanned, `✦ Saved ${label}${summary}`);
        if (debug) console.log(`           → ingested OK`);
      } else {
        failed += 1;
        if (ing.error) errors.push(`${label}: ${ing.error}`);
        reportProgress(label, scanned, `✗ Failed ${label}`);
        if (debug) console.log(`           → failed: ${ing.error ?? 'unknown'}`);
      }
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${label}: ${msg}`);
      reportProgress(label, scanned, `✗ Error on ${label}: ${msg.slice(0, 40)}`);
      if (debug) console.log(`[scan-debug] #${scanned} "${label}" → exception: ${msg}`);
    }

    if (opts.delayMs > 0) {
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
  }

  return { scanned, ingested, skippedEmpty, failed, errors };
}
