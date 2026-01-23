-- Add columns to support extended WAHA events
ALTER TABLE public.waha_messages
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS ack_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reaction TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reply_to_id TEXT DEFAULT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waha_messages_message_id ON public.waha_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_waha_messages_chat_id ON public.waha_messages(chat_id);