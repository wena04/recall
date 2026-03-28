-- Rich signals from chat transcripts (MiniMax extraction) — not model training; stored for Recall / RAG
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS recall_enrichment JSONB;
