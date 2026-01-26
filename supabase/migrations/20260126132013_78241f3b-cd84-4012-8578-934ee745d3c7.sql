-- 1. Create AI Chat Sessions table for persistent chat history
CREATE TABLE public.ai_chat_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL DEFAULT 'Nueva conversación',
    model TEXT NOT NULL DEFAULT 'sonar-pro',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create AI Chat Messages table
CREATE TABLE public.ai_chat_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create WhatsApp Chat Folders table
CREATE TABLE public.whatsapp_chat_folders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Add folder_id to whatsapp_chats
ALTER TABLE public.whatsapp_chats 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.whatsapp_chat_folders(id) ON DELETE SET NULL;

-- 5. Add whatsapp_sent_count to leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS whatsapp_sent_count INTEGER NOT NULL DEFAULT 0;

-- 6. Enable RLS on new tables
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chat_folders ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for ai_chat_sessions
CREATE POLICY "Users can view their own sessions" ON public.ai_chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON public.ai_chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON public.ai_chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON public.ai_chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- 8. RLS Policies for ai_chat_messages
CREATE POLICY "Users can view their own messages" ON public.ai_chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON public.ai_chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON public.ai_chat_messages
    FOR DELETE USING (auth.uid() = user_id);

-- 9. RLS Policies for whatsapp_chat_folders
CREATE POLICY "Users can view their own folders" ON public.whatsapp_chat_folders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders" ON public.whatsapp_chat_folders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" ON public.whatsapp_chat_folders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" ON public.whatsapp_chat_folders
    FOR DELETE USING (auth.uid() = user_id);

-- 10. Create indexes
CREATE INDEX idx_ai_chat_sessions_user_id ON public.ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_sessions_updated_at ON public.ai_chat_sessions(updated_at DESC);
CREATE INDEX idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id);
CREATE INDEX idx_whatsapp_chat_folders_user_id ON public.whatsapp_chat_folders(user_id);
CREATE INDEX idx_whatsapp_chats_folder_id ON public.whatsapp_chats(folder_id);
CREATE INDEX idx_leads_whatsapp_sent_count ON public.leads(whatsapp_sent_count);

-- 11. Trigger for updating ai_chat_sessions.updated_at
CREATE OR REPLACE FUNCTION public.update_ai_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.ai_chat_sessions 
    SET updated_at = now() 
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_session_on_new_message
AFTER INSERT ON public.ai_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_session_timestamp();