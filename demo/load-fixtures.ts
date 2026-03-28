/**
 * Demo fixture loader — seeds sample_data.json into Supabase
 * Usage: USER_ID=<your-supabase-user-id> npm run demo:load
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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

const fixtures = JSON.parse(
  readFileSync(join(__dirname, 'sample_data.json'), 'utf-8')
) as Array<{
  original_content_url: string;
  summary: string;
  category: string;
  location_city: string | null;
  location_name: string | null;
  action_items: { task: string; owner: string }[];
  source_context: string;
  source_type: string;
}>;

console.log(`Loading ${fixtures.length} demo fixtures for user ${USER_ID}...\n`);

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
