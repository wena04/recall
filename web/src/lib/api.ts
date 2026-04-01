import { supabase } from '@/lib/supabase';

/** Merge session JWT (or dev-bypass agent secret) into API calls to Express. */
export async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  const bypass =
    import.meta.env.VITE_DEV_BYPASS_AUTH === 'true' && import.meta.env.VITE_DEV_USER_ID;
  if (bypass) {
    const secret = import.meta.env.VITE_RECALL_AGENT_SECRET as string | undefined;
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }
    return headers;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const base = init ?? {};
  const merged = new Headers(base.headers);
  const auth = await authHeaders();
  const authRec = auth as Record<string, string>;
  if (authRec.Authorization && !merged.has('Authorization')) {
    merged.set('Authorization', authRec.Authorization);
  }
  return fetch(input, { ...base, headers: merged });
}
