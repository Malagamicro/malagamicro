
-- Table to track security blocks on login
CREATE TABLE public.login_security_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ip_address TEXT,
  reason TEXT NOT NULL,
  alert_details JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '2 hours'),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

ALTER TABLE public.login_security_blocks ENABLE ROW LEVEL SECURITY;

-- Service role inserts (from edge function), admins can view/manage
CREATE POLICY "Admins can view all blocks"
  ON public.login_security_blocks FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update blocks"
  ON public.login_security_blocks FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can check if they themselves are blocked
CREATE POLICY "Users can view own blocks"
  ON public.login_security_blocks FOR SELECT
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_login_blocks_active ON public.login_security_blocks (user_id, is_active, expires_at);
