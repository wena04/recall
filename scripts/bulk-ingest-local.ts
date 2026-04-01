/**
 * Walk local folders and POST each text file (in chunks) to POST /api/message.
 * This seeds your Supabase "brain" from WeChat/WhatsApp exports, notes, etc.
 *
 * MiniMax is not "trained" here — each chunk goes through the same extraction API.
 *
 * Usage (API must be running: npm run server:dev or npm run dev):
 *   USER_ID=<auth-uuid> npx tsx scripts/bulk-ingest-local.ts "/path/to/wechat/Backup/.../files" ~/Downloads/chat-exports
 *
 * Options:
 *   --dry-run          List files only
 *   --delay-ms=800     Pause between requests (rate limits)
 *   --api=http://localhost:3001
 *
 * @module
 */
import 'dotenv/config';
import { readdir, readFile, stat } from 'node:fs/promises';

function apiAuthHeaders(): Record<string, string> {
  const s = process.env.RECALL_AGENT_SECRET!.trim();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${s}` };
}
import { join, extname, resolve } from 'node:path';

const TEXT_EXT = new Set(['.txt', '.log', '.md', '.csv', '.text']);

const MAX_CHUNK_CHARS = 12_000;

function parseArgs() {
  const argv = process.argv.slice(2);
  const roots: string[] = [];
  let dryRun = false;
  let delayMs = 600;
  let apiBase = process.env.INGEST_API_URL ?? 'http://localhost:3001';

  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a.startsWith('--delay-ms='))
      delayMs = Math.max(0, parseInt(a.split('=')[1]!, 10) || 0);
    else if (a.startsWith('--api=')) apiBase = a.slice('--api='.length);
    else if (!a.startsWith('--')) roots.push(resolve(a));
  }

  return { roots, dryRun, delayMs, apiBase };
}

async function walk(dir: string, files: string[]): Promise<void> {
  let st;
  try {
    st = await stat(dir);
  } catch {
    console.warn(`Skip (not found): ${dir}`);
    return;
  }
  if (!st.isDirectory()) {
    if (TEXT_EXT.has(extname(dir).toLowerCase())) files.push(dir);
    return;
  }

  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, files);
    else if (TEXT_EXT.has(extname(e.name).toLowerCase())) files.push(p);
  }
}

function chunkText(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  if (s.length <= MAX_CHUNK_CHARS) return [s];

  const parts: string[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + MAX_CHUNK_CHARS, s.length);
    if (end < s.length) {
      const cut = s.lastIndexOf('\n\n', end);
      if (cut > i + MAX_CHUNK_CHARS / 2) end = cut;
    }
    const piece = s.slice(i, end).trim();
    if (piece) parts.push(piece);
    i = end;
  }
  return parts;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { roots, dryRun, delayMs, apiBase } = parseArgs();
  const userId =
    process.env.USER_ID ??
    process.env.VITE_DEV_USER_ID ??
    process.env.SECOND_BRAIN_USER_ID;

  if (roots.length === 0) {
    console.error(`Usage: USER_ID=<uuid> npx tsx scripts/bulk-ingest-local.ts <dir> [dir...]

Example:
  USER_ID=xxx npx tsx scripts/bulk-ingest-local.ts "$HOME/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/Backup/wxid_xxx/.../files"

Start the API first (npm run dev).`);
    process.exit(1);
  }

  if (!userId) {
    console.error('Set USER_ID or VITE_DEV_USER_ID (Supabase auth.users id).');
    process.exit(1);
  }
  if (!process.env.RECALL_AGENT_SECRET?.trim()) {
    console.error('Set RECALL_AGENT_SECRET in .env (same as API server).');
    process.exit(1);
  }

  const allFiles: string[] = [];
  for (const r of roots) await walk(r, allFiles);

  console.log(`Found ${allFiles.length} text files under ${roots.length} root(s).`);
  if (dryRun) {
    for (const f of allFiles) console.log(`  ${f}`);
    process.exit(0);
  }

  const url = `${apiBase.replace(/\/$/, '')}/api/message`;
  let ok = 0;
  let fail = 0;

  for (const filePath of allFiles) {
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch (e) {
      console.warn(`  ✗ read ${filePath}:`, e);
      fail++;
      continue;
    }

    const chunks = chunkText(raw);
    for (let c = 0; c < chunks.length; c++) {
      const header =
        chunks.length > 1
          ? `[File: ${filePath} — part ${c + 1}/${chunks.length}]\n\n`
          : `[File: ${filePath}]\n\n`;
      const content = header + chunks[c];

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: apiAuthHeaders(),
          body: JSON.stringify({
            userId,
            type: 'bulk_local',
            content,
            source_type: 'chat_export',
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          console.warn(`  ✗ ${filePath} chunk ${c + 1}: ${j.error ?? res.status}`);
          fail++;
        } else {
          console.log(`  ✓ ${filePath}${chunks.length > 1 ? ` [${c + 1}/${chunks.length}]` : ''}`);
          ok++;
        }
      } catch (e) {
        console.warn(`  ✗ ${filePath} chunk ${c + 1}:`, e);
        fail++;
      }

      if (delayMs > 0) await sleep(delayMs);
    }
  }

  console.log(`\nDone. Success: ${ok}, failed: ${fail}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
