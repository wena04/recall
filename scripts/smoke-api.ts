/**
 * Smoke-test local API (run API on PORT first, default 3001).
 * Uses VITE_DEV_USER_ID or DEV_USER_ID from .env.
 */
import 'dotenv/config';

const base = `http://localhost:${process.env.PORT ?? '3001'}`;
const userId = process.env.VITE_DEV_USER_ID ?? process.env.DEV_USER_ID;
if (!userId) {
  console.error('Set VITE_DEV_USER_ID in .env or run: npm run dev:ensure-user');
  process.exit(1);
}

const sample =
  'Philz Coffee in Sawtelle — we said we would go Saturday; Sarah picks the time.';

async function main() {
  const health = await fetch(`${base}/api/health`);
  console.log('GET /api/health', health.status, await health.text());

  const ingest = await fetch(`${base}/api/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      type: 'text',
      content: sample,
      source_type: 'text',
    }),
  });
  const body = await ingest.text();
  console.log('POST /api/message', ingest.status, body.slice(0, 500));

  const list = await fetch(`${base}/api/knowledge_items/${userId}`);
  console.log('GET /api/knowledge_items', list.status, (await list.text()).slice(0, 800));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
