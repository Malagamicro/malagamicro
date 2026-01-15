-- Add unsubscribed column to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email_unsubscribed BOOLEAN DEFAULT false;

-- Create table to track individual campaign emails
CREATE TABLE IF NOT EXISTS public.campaign_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, opened
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_emails ENABLE ROW LEVEL SECURITY;

-- Policies for campaign_emails (through campaign ownership)
CREATE POLICY "Users can view campaign emails via campaigns"
ON public.campaign_emails FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM email_campaigns 
    WHERE email_campaigns.id = campaign_emails.campaign_id 
    AND email_campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert campaign emails via campaigns"
ON public.campaign_emails FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM email_campaigns 
    WHERE email_campaigns.id = campaign_emails.campaign_id 
    AND email_campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update campaign emails via campaigns"
ON public.campaign_emails FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM email_campaigns 
    WHERE email_campaigns.id = campaign_emails.campaign_id 
    AND email_campaigns.user_id = auth.uid()
  )
);

-- Add RLS policies for email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates"
ON public.email_templates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
ON public.email_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON public.email_templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON public.email_templates FOR DELETE
USING (auth.uid() = user_id);

-- Add RLS policies for email_campaigns
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaigns"
ON public.email_campaigns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns"
ON public.email_campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
ON public.email_campaigns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
ON public.email_campaigns FOR DELETE
USING (auth.uid() = user_id);