import { parseExtraction, type ExtractionResult } from './extract.js';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;
const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL ?? 'https://api.minimax.chat/v1';

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

function chatCompletionUrl(): string {
  return MINIMAX_GROUP_ID
    ? `${MINIMAX_BASE_URL}/text/chatcompletion_v2?GroupId=${MINIMAX_GROUP_ID}`
    : `${MINIMAX_BASE_URL}/text/chatcompletion_v2`;
}

async function callMiniMax(
  messages: Array<{ role: string; content: string | unknown[] }>,
): Promise<string> {
  if (!MINIMAX_API_KEY) {
    throw new Error('MINIMAX_API_KEY is not set');
  }

  const response = await fetch(chatCompletionUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0].message.content;
}

export async function extractContent(
  content: string,
  options?: { userPreamble?: string },
): Promise<ExtractionResult | null> {
  if (!MINIMAX_API_KEY) {
    console.error('MINIMAX_API_KEY is not set');
    return null;
  }

  const userPayload = options?.userPreamble?.trim()
    ? `${options.userPreamble.trim()}\n\n---TRANSCRIPT---\n\n${content}`
    : content;

  try {
    const raw = await callMiniMax([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPayload },
    ]);
    const parsed = parseJsonFromModelContent(raw);
    return parseExtraction(parsed);
  } catch (error) {
    console.error('Error calling MiniMax API:', error);
    return null;
  }
}

export async function extractContentFromImage(params: {
  imageBase64: string;
  mimeType: string;
  caption?: string;
}): Promise<ExtractionResult | null> {
  if (!MINIMAX_API_KEY) {
    console.error('MINIMAX_API_KEY is not set');
    return null;
  }

  const { imageBase64, mimeType, caption } = params;
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  const textPart =
    caption?.trim() ??
    'No extra caption; infer everything from the image.';

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: 'text',
      text: `User caption (may be empty): ${textPart}`,
    },
    {
      type: 'image_url',
      image_url: { url: dataUrl },
    },
  ];

  try {
    const raw = await callMiniMax([
      { role: 'system', content: VISION_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ]);
    const parsed = parseJsonFromModelContent(raw);
    return parseExtraction(parsed);
  } catch (error) {
    console.error('Error calling MiniMax Vision API:', error);
    return null;
  }
}
