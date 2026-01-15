-- Drop existing campaign_emails policies
DROP POLICY IF EXISTS "Users can view campaign emails via campaigns" ON public.campaign_emails;
DROP POLICY IF EXISTS "Users can insert campaign emails via campaigns" ON public.campaign_emails;
DROP POLICY IF EXISTS "Users can update campaign emails via campaigns" ON public.campaign_emails;

-- Create new policies that verify BOTH campaign ownership AND lead ownership
-- This prevents potential lead data exposure if campaigns are ever shared

-- SELECT: User must own both the campaign AND the lead
CREATE POLICY "Users can view campaign emails for their leads"
ON public.campaign_emails FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM email_campaigns
    WHERE email_campaigns.id = campaign_emails.campaign_id
    AND email_campaigns.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = campaign_emails.lead_id
    AND leads.user_id = auth.uid()
  )
);

-- INSERT: User must own both the campaign AND the lead
CREATE POLICY "Users can insert campaign emails for their leads"
ON public.campaign_emails FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM email_campaigns
    WHERE email_campaigns.id = campaign_emails.campaign_id
    AND email_campaigns.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = campaign_emails.lead_id
    AND leads.user_id = auth.uid()
  )
);

-- UPDATE: User must own both the campaign AND the lead
CREATE POLICY "Users can update campaign emails for their leads"
ON public.campaign_emails FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM email_campaigns
    WHERE email_campaigns.id = campaign_emails.campaign_id
    AND email_campaigns.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = campaign_emails.lead_id
    AND leads.user_id = auth.uid()
  )
);

-- DELETE: User must own both the campaign AND the lead
CREATE POLICY "Users can delete campaign emails for their leads"
ON public.campaign_emails FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM email_campaigns
    WHERE email_campaigns.id = campaign_emails.campaign_id
    AND email_campaigns.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = campaign_emails.lead_id
    AND leads.user_id = auth.uid()
  )
);