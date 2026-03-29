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
  /** Override `SECOND_BRAIN_USER_ID` (e.g. Connect scan for the logged-in Supabase user). */
  userId?: string;
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
  const userId = opts?.userId?.trim() || process.env.SECOND_BRAIN_USER_ID;
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

export async function querySecondBrain(question: string): Promise<string> {
  const base = process.env.SECOND_BRAIN_API_URL?.replace(/\/$/, "");
  const userId = process.env.SECOND_BRAIN_USER_ID;
  if (!base || !userId) {
    return "The Second Brain API is not configured. Please set SECOND_BRAIN_API_URL and SECOND_BRAIN_USER_ID.";
  }

  try {
    const res = await fetch(`${base}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, question }),
    });
    const j = await res.json();
    if (!res.ok) {
      return j.error ?? "Failed to query the Second Brain.";
    }
    return j.answer;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Same RAG path as Dashboard Mirror Memory — `POST /api/query`. */
export async function queryMirrorMemory(
  question: string,
  userIdOverride?: string,
): Promise<{ ok: true; answer: string } | { ok: false; error: string }> {
  const base = process.env.SECOND_BRAIN_API_URL?.replace(/\/$/, '');
  const userId = userIdOverride?.trim() || process.env.SECOND_BRAIN_USER_ID;
  if (!base && !userId) {
    return {
      ok: false,
      error:
        'Missing both SECOND_BRAIN_API_URL and SECOND_BRAIN_USER_ID in .env (repo root or packages/imessage-agent/)',
    };
  }
  if (!base) {
    return {
      ok: false,
      error: 'Missing SECOND_BRAIN_API_URL — add e.g. http://127.0.0.1:3001 (same port as `npm run dev` API)',
    };
  }
  if (!userId) {
    return {
      ok: false,
      error:
        'Missing SECOND_BRAIN_USER_ID — paste your Supabase auth user uuid (same as Connect page / Dashboard session)',
    };
  }

  const q = question.trim();
  if (!q) {
    return { ok: false, error: 'Empty question' };
  }

  try {
    const res = await fetch(`${base}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, question: q }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; answer?: string };
    if (!res.ok) {
      return { ok: false, error: j.error ?? `HTTP ${res.status}` };
    }
    if (typeof j.answer !== 'string' || !j.answer.trim()) {
      return { ok: false, error: 'Empty answer from /api/query' };
    }
    return { ok: true, answer: j.answer.trim() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
