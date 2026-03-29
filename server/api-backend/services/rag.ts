import { supabase } from "../lib/supabase.js";
import { callMiniMaxTextCompletion, callMiniMaxEmbedding } from "./llm.js";

const RAG_MODEL = process.env.MINIMAX_RAG_MODEL || "MiniMax-M2.7";

// ─── Fetch personality profile for richer system prompt ───────────────────────

async function getUserPersonality(userId: string): Promise<string> {
  const { data } = await supabase
    .from("user_personality")
    .select("profile")
    .eq("user_id", userId)
    .single();

  if (!data?.profile) return "";
  const p = data.profile as Record<string, unknown>;
  const parts: string[] = [];
  if (p.mbti_guess) parts.push(`MBTI: ${p.mbti_guess} (${p.mbti_confidence} confidence)`);
  if (p.personality_summary) parts.push(String(p.personality_summary));
  if (Array.isArray(p.communication_traits) && p.communication_traits.length)
    parts.push(`Communication style: ${(p.communication_traits as string[]).join(", ")}`);
  if (p.language_style) parts.push(`Language: ${p.language_style}`);
  return parts.join("\n");
}

// ─── Semantic vector search via pgvector RPC ──────────────────────────────────

async function semanticSearch(
  userId: string,
  question: string,
): Promise<{ summary: string; source_context: string | null }[]> {
  let queryVec: number[][];
  try {
    queryVec = await callMiniMaxEmbedding([question], "query");
  } catch (e) {
    console.warn("Embedding query failed, skipping semantic search:", (e as Error).message);
    return [];
  }

  const { data, error } = await supabase.rpc("match_knowledge_items", {
    query_embedding: JSON.stringify(queryVec[0]),
    match_user_id: userId,
    match_count: 5,
  });

  if (error) {
    console.warn("pgvector RPC failed:", error.message);
    return [];
  }

  return (data ?? []) as { summary: string; source_context: string | null }[];
}

// ─── FTS + ilike fallback ─────────────────────────────────────────────────────

async function keywordSearch(
  userId: string,
  question: string,
): Promise<{ summary: string; source_context: string | null }[]> {
  const q = question.trim();
  if (!q) return [];

  const { data: ftsData, error: ftsError } = await supabase
    .from("knowledge_items")
    .select("summary, source_context")
    .eq("user_id", userId)
    .textSearch("summary", q, { type: "websearch" })
    .limit(5);

  if (!ftsError && ftsData && ftsData.length > 0) return ftsData;

  const firstWord = q.split(/\s+/)[0];
  const { data: ilikeData } = await supabase
    .from("knowledge_items")
    .select("summary, source_context")
    .eq("user_id", userId)
    .ilike("summary", `%${firstWord}%`)
    .limit(5);

  return ilikeData ?? [];
}

// ─── Main query handler ───────────────────────────────────────────────────────

export async function handleQuery(userId: string, question: string): Promise<string> {
  // 1. Try semantic vector search first, fall back to keyword search
  let items = await semanticSearch(userId, question);

  if (items.length === 0) {
    items = await keywordSearch(userId, question);
  }

  // 2. If still empty, grab the most recent items for general context
  if (items.length === 0) {
    const { data: recentData } = await supabase
      .from("knowledge_items")
      .select("summary, source_context")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    items = recentData ?? [];
  }

  // 3. Load personality profile for richer, more personal answers
  const personality = await getUserPersonality(userId);

  // 4. Build system prompt
  const context = items
    .map((item) => `- ${item.summary}${item.source_context ? ` (${item.source_context.slice(0, 120)})` : ""}`)
    .join("\n");

  const personalitySection = personality
    ? `\nYour personality profile:\n${personality}\n`
    : "";

  const systemPrompt = `You are a digital clone of a person — Mirror Memory. Answer questions based on their saved memories, using their own voice and style. Be specific and personal, not generic.${personalitySection}

Relevant memories (from Second Brain — may include many different iMessage threads, exports, and notes the user saved earlier):
${context || "(no specific memories matched this query yet)"}

Important: The user message may end with a block like "--- Recent iMessage context from thread …". That block is ONLY the chat where they triggered Recall right now — often just the Mirror/Recall bot loop. It is **not** their full history. For questions about another person or thread (e.g. "David"), rely **first** on the bulleted memories above if they mention that person; ignore irrelevant bot back-and-forth in the snippet. If no saved memory mentions them, say honestly that nothing about that person/thread is saved yet and they can save it by using Recall in that conversation, scan-all, or the web Connect flow — do not invent a private chat you did not see in the memories list.`;

  // 5. Call MiniMax M2.7
  const answer = await callMiniMaxTextCompletion(
    `User message (question, optional single-thread iMessage excerpt):\n${question}`,
    systemPrompt,
    RAG_MODEL,
  );

  return answer;
}
