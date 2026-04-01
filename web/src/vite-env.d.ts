/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Set to "true" to skip login; requires VITE_DEV_USER_ID (must exist in auth.users). */
  readonly VITE_DEV_BYPASS_AUTH?: string
  readonly VITE_DEV_USER_ID?: string
  /** Same value as server RECALL_AGENT_SECRET — required for /api/* when using dev bypass (no session). */
  readonly VITE_RECALL_AGENT_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
