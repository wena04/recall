-- Enable pgvector extension (must be done in Supabase dashboard or here)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to knowledge_items
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS knowledge_items_embedding_hnsw
  ON knowledge_items USING hnsw (embedding vector_cosine_ops);

-- Semantic similarity search RPC (called from rag.ts)
CREATE OR REPLACE FUNCTION match_knowledge_items(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     int DEFAULT 5
)
RETURNS TABLE (id uuid, summary text, source_context text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    summary,
    source_context,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_items
  WHERE user_id = match_user_id
    AND embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- User personality profile table (one row per user, upserted on recompute)
CREATE TABLE IF NOT EXISTS user_personality (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  profile     JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_personality ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own personality"
  ON user_personality FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
