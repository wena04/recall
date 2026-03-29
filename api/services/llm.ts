import { parseExtraction, type ExtractionResult } from "./extract.js";

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;

/** Anthropic-compatible base (text). Default: https://platform.minimax.io/docs/api-reference/text-anthropic-api */
const MINIMAX_ANTHROPIC_BASE_URL =
  process.env.MINIMAX_ANTHROPIC_BASE_URL ?? "https://api.minimax.io/anthropic";

/** Text model for Anthropic Messages API (M2.x family). */
const MINIMAX_MODEL = process.env.MINIMAX_MODEL ?? "MiniMax-M2.7";

/** Native MiniMax chat completion host (vision + optional legacy). Falls back to legacy `MINIMAX_BASE_URL` if set. */
const MINIMAX_LEGACY_BASE_URL =
  process.env.MINIMAX_LEGACY_BASE_URL ??
  process.env.MINIMAX_BASE_URL ??
  "https://api.minimax.io/v1";

/** Model for native /text/chatcompletion_v2 (multimodal). */
const MINIMAX_LEGACY_MODEL = process.env.MINIMAX_LEGACY_MODEL ?? MINIMAX_MODEL;

const JSON_RULES = `"persona" is either null or an object:
  { "chat_role": "short label e.g. friend, group chat, customer service, official account, bot-like assistant",
    "tone": "brief style: formal/casual/playful/etc.",
    "bot_likelihood": "high" | "medium" | "low" | "unknown",
    "notes": "1–3 sentences: who the other party seems to be, automation cues if any" }`;

const SYSTEM_PROMPT = `You are a knowledge extraction engine. When given any text (chat logs, links, notes, or descriptions), extract structured information and return ONLY valid JSON matching this exact schema:

{
  "summary": "Short 2-sentence summary of the content.",
  "category": "Food | Events | Sports | Ideas | Medical",
  "location": {
    "city": "city name or null",
    "specific_name": "venue/place name or null"
  },
  "action_items": [
    { "task": "action to take", "owner": "who should do it" }
  ],
  "source_context": "The key original text snippet or description.",
  "persona": null,
  "recall_enrichment": null
}

Also allow "recall_enrichment" as an object when the input is a multi-party chat or iMessage transcript:
{
  "keywords": ["≤15 short tags: deadlines, tools, people, themes worth indexing"],
  "places": ["locations, campuses, venues mentioned"],
  "courses_or_projects": ["e.g. INFO 340, INFO 330, capstone"],
  "texting_style": "one paragraph: tone, slang/emoji, formality, language mix (EN/ZH/etc.)"
}
- For a single note, link, or non-chat paste, set "recall_enrichment" to null.
- For chat logs, fill recall_enrichment as richly as the text allows (still respect privacy: do not invent people or events not implied).

${JSON_RULES}
- For plain notes/links with no chat identity, set "persona" to null.
- For chat exports, infer persona when possible; otherwise null.

Rules:
- category must be exactly one of: Food, Events, Sports, Ideas, Medical
- location fields are null if no location is mentioned
- action_items is [] if no actions are implied
- Return ONLY the JSON object, no markdown, no explanation`;

const VISION_SYSTEM_PROMPT = `You see a screenshot (often a mobile chat such as WeChat). Read visible bubbles, names, timestamps, and UI chrome. Extract structured information and return ONLY valid JSON:

{
  "summary": "Short 2-sentence summary of what the conversation is about.",
  "category": "Food | Events | Sports | Ideas | Medical",
  "location": {
    "city": "city name or null",
    "specific_name": "venue/place name or null"
  },
  "action_items": [
    { "task": "action to take", "owner": "who should do it" }
  ],
  "source_context": "A concise transcript or key phrases you read from the image.",
  "persona": { ... },
  "recall_enrichment": null
}

Include "recall_enrichment" only if the image clearly shows a multi-message chat; else null.

${JSON_RULES}
- Always return a non-null "persona" object; do your best from avatars, nicknames, 公众号-style headers, or bot-like canned replies.
- category must be exactly one of: Food, Events, Sports, Ideas, Medical
- Return ONLY the JSON object, no markdown, no explanation`;

function parseJsonFromModelContent(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence) {
    return JSON.parse(fence[1].trim());
  }
  return JSON.parse(trimmed);
}

function chatCompletionV2Url(): string {
  const base = MINIMAX_LEGACY_BASE_URL.replace(/\/$/, "");
  return MINIMAX_GROUP_ID
    ? `${base}/text/chatcompletion_v2?GroupId=${MINIMAX_GROUP_ID}`
    : `${base}/text/chatcompletion_v2`;
}

/** MiniMax native chat completion: OpenAI-like `choices` + optional `base_resp`. */
function extractTextFromChatCompletionBody(data: unknown): string {
  if (!data || typeof data !== "object") {
    throw new Error("MiniMax: empty or invalid JSON body");
  }
  const d = data as Record<string, unknown>;
  const baseResp = d.base_resp as
    | { status_code?: number; status_msg?: string }
    | undefined;
  if (
    baseResp &&
    typeof baseResp.status_code === "number" &&
    baseResp.status_code !== 0
  ) {
    throw new Error(
      `MiniMax base_resp: ${baseResp.status_code} ${baseResp.status_msg ?? ""}`.trim(),
    );
  }

  const choices = d.choices as
    | Array<{
        message?: { content?: string };
        delta?: { content?: string };
      }>
    | undefined;

  const first = choices?.[0];
  const fromMessage = first?.message?.content;
  const fromDelta = first?.delta?.content;
  const text =
    typeof fromMessage === "string"
      ? fromMessage
      : typeof fromDelta === "string"
        ? fromDelta
        : null;

  if (text !== null && text.length > 0) {
    return text;
  }

  const reply = d.reply;
  if (typeof reply === "string" && reply.length > 0) {
    return reply;
  }

  throw new Error(
    `MiniMax: could not parse assistant text (no choices[0].message.content). Keys: ${Object.keys(d).join(", ")}`,
  );
}

/** Anthropic Messages API shape returned by MiniMax compatibility layer. */
function extractTextFromAnthropicMessageBody(data: unknown): string {
  if (!data || typeof data !== "object") {
    throw new Error("MiniMax Anthropic: empty or invalid JSON body");
  }
  const d = data as Record<string, unknown>;
  const content = d.content as
    | Array<{ type?: string; text?: string }>
    | undefined;
  if (!Array.isArray(content)) {
    throw new Error(
      `MiniMax Anthropic: expected content[]; got ${JSON.stringify(data).slice(0, 400)}`,
    );
  }
  const parts = content
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string);
  if (parts.length === 0) {
    throw new Error("MiniMax Anthropic: no text blocks in content[]");
  }
  return parts.join("");
}

/**
 * Text extraction via Anthropic-compatible Messages API (recommended for M2.x).
 * @see https://platform.minimax.io/docs/api-reference/text-anthropic-api
 */
async function callMiniMaxAnthropicMessages(userText: string): Promise<string> {
  return await callMiniMaxTextCompletion(userText, SYSTEM_PROMPT);
}

/**
 * Generic text completion via Anthropic-compatible Messages API.
 * @see https://platform.minimax.io/docs/api-reference/text-anthropic-api
 */
export async function callMiniMaxTextCompletion(
  userText: string,
  systemPrompt: string,
  model?: string,
  maxTokens?: number,
): Promise<string> {
  if (!MINIMAX_API_KEY) {
    throw new Error("MINIMAX_API_KEY is not set");
  }

  const url = `${MINIMAX_ANTHROPIC_BASE_URL.replace(/\/$/, "")}/v1/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MINIMAX_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || MINIMAX_MODEL,
      max_tokens: maxTokens ?? 8192,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: userText }],
        },
      ],
    }),
  });

  const rawText = await response.text();
  let data: unknown;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(
      `MiniMax Anthropic: non-JSON response (${response.status}): ${rawText.slice(0, 500)}`,
    );
  }

  if (!response.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? JSON.stringify((data as { error?: unknown }).error)
        : rawText.slice(0, 500);
    throw new Error(`MiniMax Anthropic HTTP ${response.status}: ${msg}`);
  }

  return extractTextFromAnthropicMessageBody(data);
}

/**
 * Native chatcompletion_v2 with explicit model — use for models not on the Anthropic compat layer (e.g. M2-her).
 */
export async function callMiniMaxChatCompletionNative(
  userText: string,
  systemPrompt: string,
  model: string,
  maxTokens = 2048,
): Promise<string> {
  if (!MINIMAX_API_KEY) throw new Error("MINIMAX_API_KEY is not set");

  const response = await fetch(chatCompletionV2Url(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.85,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
    }),
  });

  const rawText = await response.text();
  let data: unknown;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(`MiniMax Native: non-JSON (${response.status}): ${rawText.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`MiniMax Native HTTP ${response.status}: ${rawText.slice(0, 300)}`);
  }
  return extractTextFromChatCompletionBody(data);
}

/**
 * Native chatcompletion_v2 (used for vision; Anthropic compat does not support images yet).
 */
async function callMiniMaxChatCompletionV2(
  messages: Array<{ role: string; content: string | unknown[] }>,
): Promise<string> {
  if (!MINIMAX_API_KEY) {
    throw new Error("MINIMAX_API_KEY is not set");
  }

  const response = await fetch(chatCompletionV2Url(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MINIMAX_LEGACY_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  const rawText = await response.text();
  let data: unknown;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(
      `MiniMax: non-JSON response (${response.status}): ${rawText.slice(0, 500)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `MiniMax API error: ${response.status} ${rawText.slice(0, 500)}`,
    );
  }

  return extractTextFromChatCompletionBody(data);
}

/**
 * Embeddings are on the native `/v1` API, not the Anthropic-compatible `/anthropic` host.
 * If MINIMAX_BASE_URL was set to `.../anthropic` (common mistake), legacy base would 404 on `/embeddings`.
 */
function resolveMiniMaxEmbeddingsBaseUrl(): string {
  const trim = (s: string) => s.replace(/\/$/, '');
  const explicit = process.env.MINIMAX_EMBEDDINGS_BASE_URL?.trim();
  if (explicit) return trim(explicit);
  const legacy = process.env.MINIMAX_LEGACY_BASE_URL?.trim();
  if (legacy && !/\/anthropic\/?$/i.test(legacy)) return trim(legacy);
  const baseUrl = process.env.MINIMAX_BASE_URL?.trim();
  if (baseUrl && !/\/anthropic\/?$/i.test(baseUrl)) return trim(baseUrl);
  return 'https://api.minimax.io/v1';
}

/**
 * MiniMax embedding API — returns 1536-dim float vectors.
 * Use type="db" when storing, type="query" when searching.
 */
export async function callMiniMaxEmbedding(
  texts: string[],
  type: 'db' | 'query' = 'db',
): Promise<number[][]> {
  if (!MINIMAX_API_KEY) {
    throw new Error('MINIMAX_API_KEY is not set');
  }

  const base = resolveMiniMaxEmbeddingsBaseUrl();
  const url = MINIMAX_GROUP_ID
    ? `${base}/embeddings?GroupId=${MINIMAX_GROUP_ID}`
    : `${base}/embeddings`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'embo-01', texts, type }),
  });

  const rawText = await response.text();
  let data: unknown;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(`MiniMax Embedding: non-JSON response (${response.status}): ${rawText.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(`MiniMax Embedding HTTP ${response.status}: ${rawText.slice(0, 300)}`);
  }

  const d = data as Record<string, unknown>;
  const vectors = d.vectors as number[][] | null | undefined;
  if (Array.isArray(vectors) && vectors.length > 0) return vectors;

  const baseResp = d.base_resp as { status_code?: number; status_msg?: string } | undefined;
  if (baseResp?.status_msg) {
    throw new Error(
      `MiniMax Embedding: ${baseResp.status_msg}${baseResp.status_code != null ? ` (code ${baseResp.status_code})` : ''}`,
    );
  }
  throw new Error(`MiniMax Embedding: unexpected response shape: ${JSON.stringify(d).slice(0, 300)}`);
}

export async function extractContent(
  content: string,
  options?: { userPreamble?: string },
): Promise<ExtractionResult | null> {
  if (!MINIMAX_API_KEY) {
    console.error("MINIMAX_API_KEY is not set");
    return null;
  }

  const userPayload = options?.userPreamble?.trim()
    ? `${options.userPreamble.trim()}\n\n---TRANSCRIPT---\n\n${content}`
    : content;

  try {
    const raw = await callMiniMaxAnthropicMessages(userPayload);
    const parsed = parseJsonFromModelContent(raw);
    return parseExtraction(parsed);
  } catch (error) {
    console.error("Error calling MiniMax API:", error);
    return null;
  }
}

export async function extractContentFromImage(params: {
  imageBase64: string;
  mimeType: string;
  caption?: string;
}): Promise<ExtractionResult | null> {
  if (!MINIMAX_API_KEY) {
    console.error("MINIMAX_API_KEY is not set");
    return null;
  }

  const { imageBase64, mimeType, caption } = params;
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  const textPart =
    caption?.trim() ?? "No extra caption; infer everything from the image.";

  const userContent: Array<{
    type: string;
    text?: string;
    image_url?: { url: string };
  }> = [
    {
      type: "text",
      text: `User caption (may be empty): ${textPart}`,
    },
    {
      type: "image_url",
      image_url: { url: dataUrl },
    },
  ];

  try {
    const raw = await callMiniMaxChatCompletionV2([
      { role: "system", content: VISION_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ]);
    const parsed = parseJsonFromModelContent(raw);
    return parseExtraction(parsed);
  } catch (error) {
    console.error("Error calling MiniMax Vision API:", error);
    return null;
  }
}
