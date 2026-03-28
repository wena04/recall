-- Location notification prefs + queue for Photon to deliver as iMessage (poll API).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_frequency TEXT DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS notification_imessage_to TEXT,
  ADD COLUMN IF NOT EXISTS last_location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_location_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_location_city TEXT,
  ADD COLUMN IF NOT EXISTS last_location_notification_at TIMESTAMPTZ;

COMMENT ON COLUMN users.notification_frequency IS 'off | hourly | every_6h | daily | new_city_only';
COMMENT ON COLUMN users.notification_imessage_to IS 'Photon send() target: phone E.164 or chatId from listChats';

CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_user_pending
  ON notification_outbox(user_id)
  WHERE delivered_at IS NULL;

-- Access only via Express (service role); not exposed to browser anon key.
