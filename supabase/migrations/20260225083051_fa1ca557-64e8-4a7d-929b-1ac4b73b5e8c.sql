
-- Table for login tracking with IP and location
CREATE TABLE public.user_login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text,
  city text,
  country text,
  region text,
  latitude double precision,
  longitude double precision,
  user_agent text,
  device_type text DEFAULT 'desktop',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all login logs"
ON public.user_login_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own login logs"
ON public.user_login_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_login_logs_user_id ON public.user_login_logs(user_id);
CREATE INDEX idx_login_logs_created_at ON public.user_login_logs(created_at DESC);

-- Table for complete interaction tracking
CREATE TABLE public.user_interaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  page text,
  element text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_interaction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all interaction logs"
ON public.user_interaction_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own interaction logs"
ON public.user_interaction_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_interaction_logs_user_id ON public.user_interaction_logs(user_id);
CREATE INDEX idx_interaction_logs_created_at ON public.user_interaction_logs(created_at DESC);
CREATE INDEX idx_interaction_logs_action ON public.user_interaction_logs(action);

-- Enable realtime for interaction logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_interaction_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_login_logs;
