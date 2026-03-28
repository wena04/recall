import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { callMiniMaxTextCompletion, callMiniMaxEmbedding } from './llm.js';

const MODEL = 'MiniMax-M2.7';

// ─── Personality profile schema ───────────────────────────────────────────────

export const PersonalityProfileSchema = z.object({
  mbti_guess: z.string(),
  mbti_confidence: z.enum(['low', 'medium', 'high']),
  personality_summary: z.string(),
  communication_traits: z.array(z.string()),
  top_interests: z.array(z.string()),
  language_style: z.string(),
  social_style: z.string(),
  emotional_tone: z.string(),
});

export type PersonalityProfile = z.infer<typeof PersonalityProfileSchema> & {
  computed_at: string;
  based_on_items: number;
};

// ─── Embed a single knowledge item (fire-and-forget from ingest) ──────────────

export async function embedKnowledgeItem(id: string, summary: string): Promise<void> {
  const vectors = await callMiniMaxEmbedding([summary], 'db');
  const embedding = vectors[0];
  if (!embedding) return;

  await supabase
    .from('knowledge_items')
    .update({ embedding: JSON.stringify(embedding) as unknown as number[] })
    .eq('id', id);
}

// ─── Compute full personality profile ─────────────────────────────────────────

export async function computePersonality(
  userId: string,
  onProgress?: (msg: string) => void,
): Promise<PersonalityProfile> {
  const emit = (msg: string) => onProgress?.(msg);

  emit('📚 Fetching your memories from the database…');

  const { data: items, error } = await supabase
    .from('knowledge_items')
    .select('recall_enrichment, persona, category, location_city')
    .eq('user_id', userId);

  if (error) throw error;
  if (!items || items.length === 0) {
    throw new Error('No memories found to analyze personality.');
  }

  emit(`✦ Found ${items.length} memories — reading your patterns…`);

  // ── Aggregate signals ──────────────────────────────────────────────────────

  const textingStyles: string[] = [];
  const keywordFreq: Record<string, number> = {};
  const categoryCount: Record<string, number> = {};
  const cities = new Set<string>();
  const tones: string[] = [];

  for (const item of items) {
    const re = item.recall_enrichment as Record<string, unknown> | null;
    const p = item.persona as Record<string, unknown> | null;

    if (re?.texting_style && typeof re.texting_style === 'string') {
      textingStyles.push(re.texting_style);
    }
    if (Array.isArray(re?.keywords)) {
      for (const kw of re.keywords as string[]) {
        keywordFreq[kw] = (keywordFreq[kw] ?? 0) + 1;
      }
    }
    if (item.category) {
      categoryCount[item.category] = (categoryCount[item.category] ?? 0) + 1;
    }
    if (item.location_city) {
      cities.add(item.location_city);
    }
    if (p?.tone && typeof p.tone === 'string') {
      tones.push(p.tone);
    }
  }

  // Top 15 keywords by frequency
  const topKeywords = Object.entries(keywordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([k, v]) => `${k} (${v}x)`);

  // Category distribution
  const categoryLines = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k}: ${v} memories`);

  if (textingStyles.length > 0) {
    emit(`💬 Analyzed ${textingStyles.length} conversation${textingStyles.length === 1 ? '' : 's'} for texting patterns`);
  }
  if (topKeywords.length > 0) {
    emit(`🏷️ Top interests detected: ${topKeywords.slice(0, 5).map(k => k.split(' ')[0]).join(', ')}`);
  }
  if (categoryLines.length > 0) {
    emit(`📊 Lifestyle distribution: ${categoryLines.slice(0, 3).join(' · ')}`);
  }
  if (cities.size > 0) {
    emit(`📍 Places in your memories: ${[...cities].slice(0, 5).join(', ')}`);
  }
  emit('🧠 Sending your profile to M2.7 for personality analysis…');
  emit('🔮 Predicting MBTI type and communication traits…');

  const system = `You are a personality analyst. Given aggregated data from a person's saved memories, text messages, and digital behavior, infer their personality profile.
Return ONLY valid JSON matching this schema exactly:
{
  "mbti_guess": "4-letter MBTI type e.g. ENFP",
  "mbti_confidence": "low | medium | high",
  "personality_summary": "2-3 sentences in second person (You are...)",
  "communication_traits": ["3-6 short traits"],
  "top_interests": ["4-8 interest areas"],
  "language_style": "one phrase describing how they write",
  "social_style": "one phrase describing social tendencies",
  "emotional_tone": "one word or short phrase"
}
Base your analysis only on the data provided. If data is sparse, use "low" confidence.`;

  const userPrompt = `Analyze this person's digital footprint:

TEXTING STYLE SAMPLES (${textingStyles.length} chats analyzed):
${textingStyles.slice(0, 10).map((s, i) => `${i + 1}. ${s.slice(0, 300)}`).join('\n\n')}

TOP KEYWORDS FROM THEIR CONVERSATIONS:
${topKeywords.join(', ') || 'none'}

MEMORY CATEGORY DISTRIBUTION:
${categoryLines.join('\n') || 'no categories'}

CITIES/PLACES MENTIONED: ${[...cities].slice(0, 10).join(', ') || 'none'}

COMMUNICATION TONES DETECTED: ${[...new Set(tones)].join(', ') || 'none'}

TOTAL MEMORIES ANALYZED: ${items.length}`;

  let raw: string;
  try {
    raw = await callMiniMaxTextCompletion(userPrompt, system, MODEL);
    emit('✦ Response received — parsing your personality profile…');
  } catch (e) {
    throw new Error(`Personality LLM call failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Strip markdown fences if present
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse personality JSON: ${raw.slice(0, 200)}`);
  }

  const result = PersonalityProfileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Personality schema invalid: ${JSON.stringify(result.error.issues)}`);
  }

  const profile: PersonalityProfile = {
    ...result.data,
    computed_at: new Date().toISOString(),
    based_on_items: items.length,
  };

  // Upsert into user_personality table
  await supabase
    .from('user_personality')
    .upsert(
      { user_id: userId, profile, computed_at: profile.computed_at },
      { onConflict: 'user_id' },
    );

  return profile;
}
