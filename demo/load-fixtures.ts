/**
 * Demo fixture loader — seeds JSON into Supabase `knowledge_items`.
 *
 *   USER_ID=<auth.users.id> npm run demo:load
 *
 * Default file: `demo/sample_data.json`. Override:
 *   FIXTURE_FILE=./data/fixtures/diverse_knowledge_items.json USER_ID=... npm run demo:load
 *
 * Rows use schema categories only: Food | Events | Sports | Ideas | Medical.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

const USER_ID = process.env.USER_ID;
if (!USER_ID) {
  console.error('Error: USER_ID env var is required. Run: USER_ID=<your-id> npm run demo:load');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const fixturePath = process.env.FIXTURE_FILE
  ? resolve(process.cwd(), process.env.FIXTURE_FILE)
  : join(__dirname, 'sample_data.json');

const fixtures = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Array<
  Record<string, unknown> & {
    original_content_url: string;
    summary: string;
    category: string;
    action_items: { task: string; owner: string }[];
    source_context: string;
    source_type: string;
  }
>;

console.log(`Loading ${fixtures.length} demo fixtures from ${fixturePath} for user ${USER_ID}...\n`);

let loaded = 0;
for (const fixture of fixtures) {
  const { error } = await supabase.from('knowledge_items').insert({
    user_id: USER_ID,
    ...fixture,
  });

  if (error) {
    console.error(`  ✗ Failed: "${fixture.summary.slice(0, 50)}..." — ${error.message}`);
  } else {
    console.log(`  ✓ Loaded [${fixture.category}]: ${fixture.location_name ?? fixture.summary.slice(0, 40)}...`);
    loaded++;
  }
}

console.log(`\nDone: ${loaded}/${fixtures.length} fixtures loaded.`);
