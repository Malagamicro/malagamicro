
-- User presence table for online status tracking
CREATE TABLE public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  device_type TEXT DEFAULT 'desktop',
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can see online status
CREATE POLICY "Authenticated users can view presence"
  ON public.user_presence FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own presence
CREATE POLICY "Users can insert their own presence"
  ON public.user_presence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence"
  ON public.user_presence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
