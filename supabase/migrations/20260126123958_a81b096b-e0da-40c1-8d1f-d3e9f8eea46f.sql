-- =============================================
-- SISTEMA DE MENSAJERÍA INTERNA ENTRE USUARIOS
-- =============================================

-- Tabla de conversaciones (puede ser 1:1 o grupal)
CREATE TABLE public.internal_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, -- Nombre opcional para grupos
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participantes de cada conversación
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(conversation_id, user_id)
);

-- Mensajes internos
CREATE TABLE public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.internal_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, file, image
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  reply_to_id UUID REFERENCES public.internal_messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para rendimiento
CREATE INDEX idx_internal_messages_conversation ON public.internal_messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX idx_internal_messages_sender ON public.internal_messages(sender_id);

-- Enable RLS
ALTER TABLE public.internal_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Función auxiliar para verificar si un usuario es participante
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id UUID, _conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE user_id = _user_id AND conversation_id = _conversation_id
  )
$$;

-- RLS Policies para internal_conversations
CREATE POLICY "Users can view conversations they participate in"
ON public.internal_conversations FOR SELECT
USING (public.is_conversation_participant(auth.uid(), id));

CREATE POLICY "Users can create conversations"
ON public.internal_conversations FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Conversation creators can update their conversations"
ON public.internal_conversations FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Conversation creators can delete their conversations"
ON public.internal_conversations FOR DELETE
USING (auth.uid() = created_by);

-- RLS Policies para conversation_participants
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants FOR SELECT
USING (public.is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Conversation creators can add participants"
ON public.conversation_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.internal_conversations
    WHERE id = conversation_id AND created_by = auth.uid()
  )
  OR auth.uid() = user_id -- Users can add themselves to group invites
);

CREATE POLICY "Admins can update participants"
ON public.conversation_participants FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.is_admin = true
  )
);

CREATE POLICY "Users can leave conversations"
ON public.conversation_participants FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies para internal_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.internal_messages FOR SELECT
USING (public.is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Users can send messages to their conversations"
ON public.internal_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_conversation_participant(auth.uid(), conversation_id)
);

CREATE POLICY "Users can edit their own messages"
ON public.internal_messages FOR UPDATE
USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages"
ON public.internal_messages FOR DELETE
USING (auth.uid() = sender_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_internal_conversations_updated_at
BEFORE UPDATE ON public.internal_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_internal_messages_updated_at
BEFORE UPDATE ON public.internal_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para mensajes
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;

-- Crear bucket para archivos de chat interno
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-files', 'chat-files', false)
ON CONFLICT (id) DO NOTHING;

-- Policies para storage de archivos de chat
CREATE POLICY "Users can upload chat files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view chat files in their conversations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-files'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own chat files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);