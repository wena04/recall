/**
 * Forward iMessage history to the Second Brain Express API (same pipeline as /connect).
 * Set SECOND_BRAIN_API_URL + SECOND_BRAIN_USER_ID in packages/imessage-agent/.env
 */

export interface IngestTranscriptOptions {
  /** Group or DM label from Photon listChats (e.g. INFO 340) */
  chatLabel?: string;
  photonChatId?: string;
  /** Extra context for MiniMax (demo hints, course names) */
  ingestNote?: string;
}

export interface IngestTranscriptResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  data?: {
    summary?: string;
    category?: string;
    action_items?: Array<{ task: string; owner: string }>;
    recall_enrichment?: {
      keywords?: string[];
      places?: string[];
      courses_or_projects?: string[];
      texting_style?: string;
    };
  };
}

export async function ingestTranscriptToSecondBrain(
  lines: string[],
  opts?: IngestTranscriptOptions,
): Promise<IngestTranscriptResult> {
  const base = process.env.SECOND_BRAIN_API_URL?.replace(/\/$/, '');
  const userId = process.env.SECOND_BRAIN_USER_ID;
  if (!base || !userId) {
    return { ok: true, skipped: true };
  }

  const content = lines.join('\n').trim();
  if (!content) return { ok: true };

  try {
    const res = await fetch(`${base}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        type: 'photon_ingest',
        content,
        source_type: 'chat_export',
        ...(opts?.chatLabel ? { chat_label: opts.chatLabel } : {}),
        ...(opts?.ingestNote ? { ingest_note: opts.ingestNote } : {}),
      }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      data?: IngestTranscriptResult['data'];
    };
    if (!res.ok) {
      return { ok: false, error: j.error ?? String(res.status) };
    }
    return { ok: true, data: j.data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
