-- Fix internal_conversations SELECT policy so the creator can read the conversation immediately after insert.
-- This is required because PostgREST inserts with RETURNING (select=*) and the row must pass SELECT RLS too.

DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.internal_conversations;

CREATE POLICY "Users can view conversations they participate in"
ON public.internal_conversations
FOR SELECT
USING (
  (created_by = auth.uid())
  OR is_conversation_participant(id, auth.uid())
);
