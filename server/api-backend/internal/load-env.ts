/**
 * Import this before any module that reads `process.env` (e.g. `lib/supabase.ts`).
 * ESM evaluates all imports before the rest of `app.ts`, so dotenv cannot run after route imports.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, '..', '..', '..', '.env');
const envResult = dotenv.config({ path: rootEnvPath });

if (envResult.error && process.env.NODE_ENV !== 'production') {
  console.warn(`[env] No or unreadable ${rootEnvPath}:`, envResult.error.message);
} else if (
  envResult.parsed &&
  Object.keys(envResult.parsed).length > 0 &&
  process.env.NODE_ENV !== 'production'
) {
  console.log(`[env] Loaded ${Object.keys(envResult.parsed).length} variables from ${rootEnvPath}`);
}
