/**
 * Uses service role to pick an existing Auth user or create a local dev user.
 * Run from repo root: npx tsx scripts/ensure-dev-auth-user.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const DEV_EMAIL = 'dev-bypass@second-brain-recall.invalid';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });
  if (listError) throw listError;

  const existing =
    list.users.find((u) => u.email === DEV_EMAIL) ?? list.users[0];
  if (existing) {
    console.log(existing.id);
    return;
  }

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: DEV_EMAIL,
      password: `${randomUUID()}Aa1!`,
      email_confirm: true,
    });
  if (createError) throw createError;
  if (!created.user?.id) {
    throw new Error('createUser returned no user id');
  }
  console.log(created.user.id);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
