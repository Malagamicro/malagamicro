-- Allow admins to remove participants from conversations they admin
CREATE POLICY "Admins can remove participants"
ON public.conversation_participants
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.is_admin = true
  )
);