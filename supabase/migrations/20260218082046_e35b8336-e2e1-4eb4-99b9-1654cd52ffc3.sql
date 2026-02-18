
-- Add unique index on message_id to prevent duplicate messages (allowing nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_waha_messages_unique_message_id 
ON waha_messages (message_id) 
WHERE message_id IS NOT NULL;
