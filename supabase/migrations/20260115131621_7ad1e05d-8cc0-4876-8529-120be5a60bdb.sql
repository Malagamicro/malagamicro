-- Add UPDATE policy on leads table to restrict users to only update their own leads
CREATE POLICY "Users can update their own leads"
ON public.leads
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add SELECT policy on lead_activities table to restrict users to only view their own activities
CREATE POLICY "Users can view their own activities"
ON public.lead_activities
FOR SELECT
USING (auth.uid() = user_id);