/**
 * iMessage reply formatting. When ingest returns MiniMax data, we format it here.
 * Stub fallback if API ingest is off or failed.
 */

export interface ChatMessage {
  sender: string;
  text: string;
  date?: string | Date;
}

type RecallEnrichment = {
  keywords?: string[];
  places?: string[];
  courses_or_projects?: string[];
  texting_style?: string;
};

const IMESSAGE_CHUNK = 3500;

function clip(s: string): string {
  if (s.length <= IMESSAGE_CHUNK) return s;
  return `${s.slice(0, IMESSAGE_CHUNK - 20)}…\n\n(trimmed)`;
}

/** Format MiniMax / DB extraction for iMessage (kept short for SMS limits). */
export function formatRecallImessageReply(params: {
  summary: string;
  category?: string;
  action_items?: Array<{ task: string; owner: string }>;
  recall_enrichment?: RecallEnrichment;
  isQuick: boolean;
  chatLabel?: string;
}): string {
  const { summary, category, action_items, recall_enrichment, isQuick, chatLabel } = params;
  // Use "Memory" in the header so the word "recall" does not re-trigger the agent on delivery.
  const lines: string[] = ['🧠 Memory'];

  if (chatLabel) lines.push(`📎 ${chatLabel}`);
  lines.push('');
  lines.push(isQuick ? '— TLDR —' : '— Summary —');
  lines.push(summary);

  if (!isQuick && category) {
    lines.push('');
    lines.push(`📁 Category: ${category}`);
  }

  if (!isQuick && action_items && action_items.length > 0) {
    lines.push('');
    lines.push('✅ Actions');
    action_items.slice(0, 5).forEach((a) => {
      lines.push(`• ${a.task}${a.owner ? ` (${a.owner})` : ''}`);
    });
  }

  if (!isQuick && recall_enrichment) {
    const k = recall_enrichment.keywords?.slice(0, 8);
    if (k?.length) {
      lines.push('');
      lines.push(`🏷 Keywords: ${k.join(', ')}`);
    }
    const c = recall_enrichment.courses_or_projects?.slice(0, 4);
    if (c?.length) {
      lines.push(`📚 Courses/projects: ${c.join(', ')}`);
    }
    const p = recall_enrichment.places?.slice(0, 4);
    if (p?.length) {
      lines.push(`📍 Places: ${p.join(', ')}`);
    }
    if (recall_enrichment.texting_style) {
      lines.push('');
      lines.push('✍️ How people text');
      lines.push(recall_enrichment.texting_style.slice(0, 400));
    }
  }

  lines.push('');
  lines.push('💾 Saved to Second Brain (Supabase).');

  return clip(lines.join('\n'));
}

/** iMessage wrapper for Dashboard-equivalent Mirror Memory (`/api/query`). */
export function formatMirrorMemoryReply(answer: string, chatLabel?: string): string {
  const lines: string[] = ['🧠 Mirror Memory'];
  if (chatLabel) lines.push(`📎 ${chatLabel}`);
  lines.push('');
  lines.push(answer.trim());
  lines.push('');
  lines.push('— Second Brain —');
  return clip(lines.join('\n'));
}

/**
 * One-line self-confirmation sent to RECALL_IMESSAGE_TARGET after auto-ingest on outgoing message.
 * NOT sent to the original conversation — only to the user's own number.
 */
export function formatSelfNotification(summary: string, category?: string): string {
  const short = summary.length > 120 ? `${summary.slice(0, 117)}…` : summary;
  return `✦ Saved to brain: ${short}${category ? ` · ${category}` : ''}`;
}

/**
 * Process a recall request (stub when API ingest unavailable)
 */
export async function processRecall(
  messages: ChatMessage[],
  sender: string,
  isQuick: boolean,
): Promise<string> {
  const msgCount = messages.length;
  const senders = [...new Set(messages.map((m) => m.sender))];
  const latest = messages.slice(-3);

  if (isQuick) {
    return clip(
      [
        '🧠 Quick Memory (offline stub)',
        '',
        `📊 ${msgCount} messages from ${senders.length} people`,
        '',
        '最近 3 条:',
        ...latest.map((m) => `  ${m.sender}: ${m.text.slice(0, 40)}…`),
        '',
        '⚠️ API ingest off or failed — connect SECOND_BRAIN_* for full MiniMax extraction.',
      ].join('\n'),
    );
  }

  return clip(
    [
      '🧠 MEMORY (offline stub)',
      '',
      `📋 ${msgCount} messages from: ${senders.join(', ')}`,
      '',
      'This is not AI — Mirror Memory did not run. Set SECOND_BRAIN_API_URL + SECOND_BRAIN_USER_ID for the agent, keep `npm run dev` running.',
    ].join('\n'),
  );
}
