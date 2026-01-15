-- Add SELECT policy for leads table so users can only view their own leads
CREATE POLICY "Users can view their own leads"
ON public.leads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);