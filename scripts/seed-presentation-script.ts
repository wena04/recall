/**
 * Inserts the hackathon pitch script as a knowledge item (full text in summary for Mirror Memory RAG).
 * Re-run safe: deletes previous row(s) marked [presentation-script-seed] for this user first.
 *
 *   npm run seed:presentation
 *   npm run seed:presentation -- --skip-embed   # DB row only (no MiniMax embedding call)
 *
 * Requires root `.env`: SUPABASE_URL, SUPABASE_SERVICE_KEY,
 * and SECOND_BRAIN_USER_ID or VITE_DEV_USER_ID.
 * Embedding also needs MINIMAX_API_KEY (unless --skip-embed).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../api/load-env.js';
import { supabase } from '../api/lib/supabase.js';
import { embedKnowledgeItem } from '../api/services/personality.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const SCRIPT_PATH = join(repoRoot, 'data/presentation-script-second-brain.txt');

const SEED_MARKER = '[presentation-script-seed]';

const userId =
  process.env.SECOND_BRAIN_USER_ID?.trim() ||
  process.env.VITE_DEV_USER_ID?.trim() ||
  process.env.USER_ID?.trim();

const skipEmbed = process.argv.includes('--skip-embed');

async function main() {
  if (!userId) {
    console.error('Set SECOND_BRAIN_USER_ID or VITE_DEV_USER_ID in .env');
    process.exit(1);
  }

  let body: string;
  try {
    body = readFileSync(SCRIPT_PATH, 'utf-8').trim();
  } catch {
    console.error(`Missing file: ${SCRIPT_PATH}`);
    process.exit(1);
  }

  const summary = `${body}\n\n(Tagged: hackathon presentation script, Second Brain Recall, judges pitch, demo flow.)`;

  const { error: delErr } = await supabase
    .from('knowledge_items')
    .delete()
    .eq('user_id', userId)
    .like('original_content_url', `${SEED_MARKER}%`);

  if (delErr) {
    console.warn('Could not remove old seed (ok if none):', delErr.message);
  }

  const { data: row, error: insErr } = await supabase
    .from('knowledge_items')
    .insert({
      user_id: userId,
      original_content_url: `${SEED_MARKER} Second Brain Recall — 3-minute live pitch (English)`,
      summary,
      category: 'Ideas',
      source_type: 'presentation_script',
      source_context: body,
    })
    .select('id')
    .single();

  if (insErr || !row) {
    console.error('Insert failed:', insErr?.message ?? 'no row');
    process.exit(1);
  }

  if (skipEmbed) {
    console.log(`✓ Seeded presentation script (no embed) for user ${userId.slice(0, 8)}… (id ${row.id})`);
    console.log('  Mirror Memory can still match via keyword search; re-run without --skip-embed for vectors.');
    return;
  }

  try {
    await embedKnowledgeItem(row.id, summary);
    console.log(`✓ Seeded presentation script for user ${userId.slice(0, 8)}… (id ${row.id})`);
    console.log('  Ask Mirror Memory / iMessage recall: e.g. “what is our presentation script?”');
  } catch (e) {
    console.error('Row inserted but embedding failed:', e instanceof Error ? e.message : e);
    console.error(
      'Fix MINIMAX_* embedding endpoint / API key and re-run `npm run seed:presentation` (replaces seed row), or use --skip-embed.',
    );
    process.exit(1);
  }
}

main();
