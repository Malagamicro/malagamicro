
CREATE TABLE public.workspace_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  message_type text NOT NULL DEFAULT 'text',
  file_url text,
  file_name text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace chat" ON public.workspace_chat_messages
  FOR SELECT TO authenticated
  USING (can_view_workspace(workspace_id, auth.uid()));

CREATE POLICY "Members can send workspace chat" ON public.workspace_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND (
      is_workspace_member(workspace_id, auth.uid()) OR
      EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND created_by = auth.uid())
    )
  );

CREATE POLICY "Users can delete own chat messages" ON public.workspace_chat_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_chat_messages;
