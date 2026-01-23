-- Create table for WhatsApp chats/contacts
CREATE TABLE public.whatsapp_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chat_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  custom_name TEXT,
  avatar_url TEXT,
  is_archived BOOLEAN DEFAULT false,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, chat_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own chats"
ON public.whatsapp_chats FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chats"
ON public.whatsapp_chats FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chats"
ON public.whatsapp_chats FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chats"
ON public.whatsapp_chats FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_whatsapp_chats_user_id ON public.whatsapp_chats(user_id);
CREATE INDEX idx_whatsapp_chats_chat_id ON public.whatsapp_chats(chat_id);
CREATE INDEX idx_whatsapp_chats_last_message ON public.whatsapp_chats(last_message_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_chats_updated_at
BEFORE UPDATE ON public.whatsapp_chats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for chat avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-avatars', 'chat-avatars', true);

-- Storage policies for chat avatars
CREATE POLICY "Chat avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-avatars');

CREATE POLICY "Users can upload their own chat avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own chat avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'chat-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own chat avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for whatsapp_chats
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;