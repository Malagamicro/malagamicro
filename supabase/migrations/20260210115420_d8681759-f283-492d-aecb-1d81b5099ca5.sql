
-- Add profile_id column to email_campaigns to track which email profile to use for sending
ALTER TABLE public.email_campaigns ADD COLUMN profile_id UUID REFERENCES public.email_profiles(id) ON DELETE SET NULL;
