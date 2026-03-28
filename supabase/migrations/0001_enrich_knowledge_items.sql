-- Migration: enrich knowledge_items with structured extraction columns
-- Run via Supabase dashboard SQL editor or `supabase db push`

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS action_items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_context TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'text';

-- Index for filtering by category on the dashboard
CREATE INDEX IF NOT EXISTS idx_knowledge_items_category ON knowledge_items (category);
