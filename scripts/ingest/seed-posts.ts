/**
 * Load data/output/seed_posts.json (from parse_cn_us_posts.py) and either:
 *   --mode api   POST each item to local POST /api/message (runs MiniMax per row)
 *   --mode db    Insert rows directly into knowledge_items (no LLM; uses parser fields)
 *
 * Usage (repo root, .env with USER_ID + SUPABASE_*; API mode also needs server up):
 *   npm run ingest:seed -- --mode db
 *   npm run ingest:seed -- --mode api --delay-ms 1200
 *
 *   npx tsx scripts/ingest/seed-posts.ts --mode db --file data/output/seed_posts.json
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

type CnSeedPost = {
  source: string;
  language: string;
  region: string;
  filename?: string;
  title: string;
  content: string;
  city_cn: string;
  state_cn: string;
  store_name: string;
  category: string;
  price_level: string;
  vibes: string[];
  tags: string[];
  signals: string[];
};

type DbCategory = 'Food' | 'Events' | 'Sports' | 'Ideas' | 'Medical';

const CN_CAT_TO_DB: Record<string, DbCategory> = {
  咖啡店: 'Food',
  餐厅: 'Food',
  甜品店: 'Food',
  酒吧: 'Food',
  超市: 'Food',
  景点: 'Events',
  商场: 'Ideas',
  其他: 'Food',
};

function mapCategory(cn: string): DbCategory {
  return CN_CAT_TO_DB[cn] ?? 'Food';
}

function buildSourceContext(post: CnSeedPost): string {
  const lines = [
    post.title,
    post.tags.length ? `标签: ${post.tags.join(', ')}` : '',
    post.vibes.length ? `场景: ${post.vibes.join(', ')}` : '',
    post.signals.length ? `signals: ${post.signals.join(', ')}` : '',
    post.price_level ? `价位: ${post.price_level}` : '',
    post.state_cn ? `州/地区: ${post.state_cn}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

function buildApiContent(post: CnSeedPost): string {
  const hints = [
    '',
    '[解析线索 — 请与正文一并理解]',
    `城市: ${post.city_cn || '(未识别)'}`,
    `店名: ${post.store_name || '(未识别)'}`,
    `中文分类: ${post.category}`,
    `标签: ${post.tags.join(' ')}`,
    `场景: ${post.vibes.join(', ')}`,
  ].join('\n');
  return post.content + hints;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let mode: 'api' | 'db' = 'db';
  let file = 'data/output/seed_posts.json';
  let delayMs = 800;
  let apiBase = process.env.INGEST_API_URL ?? 'http://localhost:3001';

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--mode' && argv[i + 1]) {
      const m = argv[++i]!;
      if (m === 'api' || m === 'db') mode = m;
    } else if (a === '--file' && argv[i + 1]) {
      file = argv[++i]!;
    } else if (a.startsWith('--delay-ms=')) {
      delayMs = Math.max(0, parseInt(a.split('=')[1]!, 10) || 0);
    } else if (a === '--api' && argv[i + 1]) {
      apiBase = argv[++i]!;
    }
  }
  return { mode, file: resolve(process.cwd(), file), delayMs, apiBase };
}

async function main() {
  const { mode, file, delayMs, apiBase } = parseArgs();
  const userId =
    process.env.USER_ID ??
    process.env.VITE_DEV_USER_ID ??
    process.env.SECOND_BRAIN_USER_ID;

  if (!userId) {
    console.error('Set USER_ID or VITE_DEV_USER_ID in .env');
    process.exit(1);
  }

  if (!existsSync(file)) {
    console.error(
      `Missing ${file}\nRun first: npm run ingest:parse-cn\n(or python3 scripts/ingest/parse_cn_us_posts.py)`,
    );
    process.exit(1);
  }

  let posts: CnSeedPost[];
  try {
    posts = JSON.parse(readFileSync(file, 'utf-8')) as CnSeedPost[];
  } catch (e) {
    console.error('Invalid JSON:', e);
    process.exit(1);
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    console.error('No posts in JSON array');
    process.exit(1);
  }

  console.log(`Mode: ${mode} — ${posts.length} post(s) from ${file}\n`);

  if (mode === 'api') {
    const secret = process.env.RECALL_AGENT_SECRET?.trim();
    if (!secret) {
      console.error('Set RECALL_AGENT_SECRET in .env (same as API server) for --mode api');
      process.exit(1);
    }
    const apiHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    };
    const url = `${apiBase.replace(/\/$/, '')}/api/message`;
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]!;
      const content = buildApiContent(post);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            userId,
            type: 'seed_posts_json',
            content,
            source_type: 'rednote',
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          console.warn(`  ✗ ${post.filename ?? i}: ${j.error ?? res.status}`);
          fail++;
        } else {
          console.log(`  ✓ ${post.filename ?? `post ${i}`}`);
          ok++;
        }
      } catch (e) {
        console.warn(`  ✗ ${post.filename ?? i}:`, e);
        fail++;
      }
      if (delayMs > 0 && i < posts.length - 1) await sleep(delayMs);
    }
    console.log(`\nAPI done. ok=${ok} fail=${fail}`);
    return;
  }

  // --mode db
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  let ok = 0;
  let fail = 0;

  for (const post of posts) {
    const summary =
      post.store_name && post.title
        ? `${post.title} — ${post.store_name}`
        : post.title || post.content.slice(0, 120);

    const row = {
      user_id: userId,
      original_content_url: post.content,
      summary,
      category: mapCategory(post.category),
      location_city: post.city_cn || null,
      location_name: post.store_name || null,
      action_items: [] as { task: string; owner: string }[],
      source_context: buildSourceContext(post),
      source_type: 'rednote',
    };

    const { error } = await supabase.from('knowledge_items').insert(row);
    if (error) {
      console.warn(`  ✗ ${post.filename ?? post.title}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${post.filename ?? post.title.slice(0, 40)}`);
      ok++;
    }
  }

  console.log(`\nDB insert done. ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
