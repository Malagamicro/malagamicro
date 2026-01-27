-- Drop policies that depend on the function
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.internal_conversations;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.internal_messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.internal_messages;

-- Drop and recreate the function with correct parameter order
DROP FUNCTION IF EXISTS public.is_conversation_participant(uuid, uuid);

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  )
$$;

-- Recreate policies with correct parameter order (conversation_id first, user_id second)
CREATE POLICY "Users can view conversations they participate in"
ON public.internal_conversations
FOR SELECT
USING (is_conversation_participant(id, auth.uid()));

CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
USING (is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can view messages in their conversations"
ON public.internal_messages
FOR SELECT
USING (is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can send messages to their conversations"
ON public.internal_messages
FOR INSERT
WITH CHECK ((auth.uid() = sender_id) AND is_conversation_participant(conversation_id, auth.uid()));