/**
 * Load env before other imports. Order: repo root `.env`, then `packages/imessage-agent/.env` (overrides).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgEnv = path.resolve(here, '..', '.env');
const rootEnv = path.resolve(here, '..', '..', '..', '.env');

dotenv.config({ path: rootEnv });
dotenv.config({ path: pkgEnv, override: true });
