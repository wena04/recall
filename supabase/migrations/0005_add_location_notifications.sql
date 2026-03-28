ALTER TABLE users ADD COLUMN last_notification_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION find_memories_near(lat float, long float, user_id uuid)
RETURNS SETOF knowledge_items
LANGUAGE sql
AS $$
  SELECT * FROM knowledge_items
  WHERE ST_DWithin(
    location::geography,
    ST_MakePoint(long, lat)::geography,
    10000 -- 10km radius
  )
  AND user_id = user_id;
$$;