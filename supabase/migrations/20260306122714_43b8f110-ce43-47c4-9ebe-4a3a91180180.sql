
CREATE TABLE public.custom_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL DEFAULT 'system',
  icon TEXT,
  color TEXT,
  action_url TEXT,
  action_label TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_popup BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.custom_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
ON public.custom_notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.custom_notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
ON public.custom_notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications"
ON public.custom_notifications FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX idx_custom_notifications_user_unread 
ON public.custom_notifications(user_id, is_read) WHERE NOT is_read;

ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_notifications;
