-- Harden RLS + RPC: private user profiles, outbox server-only via PostgREST, vector RPC service_role only.

-- 1) Users: stop exposing every profile (Notion tokens, iMessage targets, etc.)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- 2) Outbox: RLS on; no policies for anon/authenticated = deny. Express uses service_role (bypasses RLS).
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

-- 3) Vector RPC: not callable with anon/authenticated JWT from the browser
REVOKE ALL ON FUNCTION public.match_knowledge_items(vector, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_knowledge_items(vector, uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.match_knowledge_items(vector, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge_items(vector, uuid, integer) TO service_role;
