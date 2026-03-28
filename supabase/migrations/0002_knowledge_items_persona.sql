-- Optional structured persona / bot-vs-human hints from Vision or chat analysis
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS persona JSONB;
