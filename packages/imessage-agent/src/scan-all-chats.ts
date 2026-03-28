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

export interface ScanAllChatsOptions {
  maxChats: number;
  messagesPerChat: number;
  delayMs: number;
  demoHint?: string;
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

  const rawList = await sdk.listChats({ limit: 5000 });
  const arr = Array.isArray(rawList) ? rawList : [];
  /** Prefer recently active threads first (still bounded by messagesPerChat each). */
  const sorted = [...arr].sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  const candidates: { chatId: string; label: string }[] = [];
  for (const c of sorted) {
    const chatId = c.chatId;
    if (!chatId) continue;
    const label = c.displayName?.trim() || humanizeChatId(chatId);
    if (patterns.length > 0) {
      const low = label.toLowerCase();
      if (!patterns.some((p) => low.includes(p.toLowerCase()))) continue;
    }
    candidates.push({ chatId, label });
    if (candidates.length >= opts.maxChats) break;
  }

  if (debug) {
    console.log(`[scan-debug] Candidate threads: ${candidates.length} (maxChats=${opts.maxChats}, messagesPerChat=${opts.messagesPerChat})`);
  }

  const ingestNoteParts: string[] = [
    'Source: Photon multi-chat scan (one thread per ingest). Extract recall_enrichment and persona when applicable.',
  ];
  if (opts.demoHint) ingestNoteParts.unshift(opts.demoHint);

  let scanned = 0;
  for (const { chatId, label } of candidates) {
    scanned += 1;
    try {
      const history = await sdk.getMessages({
        chatId,
        limit: opts.messagesPerChat,
        excludeOwnMessages: false,
        excludeReactions: true,
      });
      const raw = history.messages || [];
      const withText = raw.filter((m: { text?: string }) => m.text && String(m.text).length > 0);
      const lines = withText.map(
        (m: { sender?: string; text?: string; date?: string }) =>
          `[${m.date ?? '?'}] ${m.sender || 'Unknown'}: ${m.text}`,
      );

      if (debug) {
        const noText = raw.length - withText.length;
        const chatIdShort = chatId.length > 48 ? `${chatId.slice(0, 45)}…` : chatId;
        console.log(
          `[scan-debug] #${scanned} "${label}"\n` +
            `           chatId: ${chatIdShort}\n` +
            `           getMessages: raw=${raw.length}, with non-empty text=${withText.length}, no/empty text=${noText}\n` +
            `           transcript lines=${lines.length}`,
        );
        if (raw.length > 0 && withText.length === 0 && raw[0]) {
          const sample = raw[0] as { text?: string; sender?: string };
          console.log(
            `           hint: first message has text? ${sample.text != null && String(sample.text).length > 0}; sender=${sample.sender ?? '?'}`,
          );
        }
      }

      if (lines.length === 0) {
        skippedEmpty += 1;
        if (debug) console.log(`           → skip (empty transcript)`);
        continue;
      }

      const ing = await ingestTranscriptToSecondBrain(lines, {
        chatLabel: label,
        photonChatId: chatId,
        ingestNote: ingestNoteParts.join('\n'),
      });

      if (ing.skipped) {
        skippedEmpty += 1;
        if (debug) console.log(`           → skip (ingest skipped: SECOND_BRAIN_* missing in ingest-api env?)`);
        continue;
      }
      if (ing.ok) {
        ingested += 1;
        if (debug) console.log(`           → ingested OK${ing.data?.summary ? ` (summary len=${ing.data.summary.length})` : ''}`);
      } else {
        failed += 1;
        if (ing.error) errors.push(`${label}: ${ing.error}`);
        if (debug) console.log(`           → failed: ${ing.error ?? 'unknown'}`);
      }
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${label}: ${msg}`);
      if (debug) console.log(`[scan-debug] #${scanned} "${label}" → exception: ${msg}`);
    }

    if (opts.delayMs > 0) {
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
  }

  return { scanned, ingested, skippedEmpty, failed, errors };
}
