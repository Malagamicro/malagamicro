
-- Extend providers table with additional business fields
ALTER TABLE public.providers 
  ADD COLUMN IF NOT EXISTS razon_social TEXT,
  ADD COLUMN IF NOT EXISTS cif_nif TEXT,
  ADD COLUMN IF NOT EXISTS direccion_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS contacto_principal TEXT,
  ADD COLUMN IF NOT EXISTS web TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS condiciones_pago TEXT;

-- Create email_profiles table for multiple SMTP/IMAP accounts
CREATE TABLE public.email_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  -- SMTP settings
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  smtp_secure TEXT NOT NULL DEFAULT 'STARTTLS',
  from_email TEXT NOT NULL,
  from_name TEXT,
  -- IMAP settings
  imap_host TEXT,
  imap_port INTEGER DEFAULT 993,
  imap_user TEXT,
  imap_password TEXT,
  imap_secure BOOLEAN DEFAULT true,
  -- Sync settings
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_sync_interval INTEGER NOT NULL DEFAULT 15,
  last_sync_at TIMESTAMPTZ,
  connection_status TEXT NOT NULL DEFAULT 'unknown',
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email profiles"
  ON public.email_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_email_profiles_updated_at
  BEFORE UPDATE ON public.email_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create email_messages table for synced inbox
CREATE TABLE public.email_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.email_profiles(id) ON DELETE CASCADE,
  message_uid TEXT,
  message_id_header TEXT,
  folder TEXT NOT NULL DEFAULT 'INBOX',
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses JSONB DEFAULT '[]',
  cc_addresses JSONB DEFAULT '[]',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  budget_request_id UUID REFERENCES public.budget_requests(id) ON DELETE SET NULL,
  labels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email messages"
  ON public.email_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_email_messages_profile ON public.email_messages(profile_id);
CREATE INDEX idx_email_messages_date ON public.email_messages(date DESC);
CREATE INDEX idx_email_messages_from ON public.email_messages(from_address);
CREATE INDEX idx_email_messages_provider ON public.email_messages(provider_id);

CREATE TRIGGER update_email_messages_updated_at
  BEFORE UPDATE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create email_attachments table
CREATE TABLE public.email_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_path TEXT,
  storage_path TEXT,
  content_id TEXT,
  is_inline BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email attachments"
  ON public.email_attachments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_email_attachments_message ON public.email_attachments(message_id);

-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can access their own email attachments"
  ON storage.objects FOR ALL
  USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for email messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_profiles;
