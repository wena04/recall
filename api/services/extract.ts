import { z } from 'zod';

/** Optional: inferred from chat exports or Vision on WeChat-style screenshots */
export const PersonaSchema = z.object({
  chat_role: z.string(),
  tone: z.string(),
  bot_likelihood: z.enum(['high', 'medium', 'low', 'unknown']),
  notes: z.string(),
});

export type PersonaResult = z.infer<typeof PersonaSchema>;

/** Keywords, places, course/project refs, texting vibe — from chat logs (Photon, exports) */
export const RecallEnrichmentSchema = z.object({
  keywords: z.array(z.string()).optional(),
  places: z.array(z.string()).optional(),
  courses_or_projects: z.array(z.string()).optional(),
  texting_style: z.string().optional(),
});

export type RecallEnrichment = z.infer<typeof RecallEnrichmentSchema>;

export const ExtractionSchema = z.object({
  summary: z.string(),
  category: z.enum(['Food', 'Events', 'Sports', 'Ideas', 'Medical']),
  location: z.object({
    city: z.string().nullable(),
    specific_name: z.string().nullable(),
  }),
  action_items: z.array(z.object({ task: z.string(), owner: z.string() })),
  source_context: z.string(),
  persona: PersonaSchema.nullable().optional(),
  recall_enrichment: z
    .any()
    .transform((val) => {
      // If LLM returns an object, try to parse it.
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const parsed = RecallEnrichmentSchema.safeParse(val);
        if (parsed.success) {
          return parsed.data;
        }
      }
      // Otherwise (string, array, junk, or unparsable object), default to null.
      return null;
    })
    .optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionSchema>;

export function parseExtraction(raw: unknown): ExtractionResult | null {
  const result = ExtractionSchema.safeParse(raw);
  if (!result.success) {
    console.error('Extraction schema validation failed:', result.error.issues);
    return null;
  }
  return result.data;
}
