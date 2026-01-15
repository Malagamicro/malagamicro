-- Clean up duplicate RLS policies on email_campaigns table
-- Keep "Users can delete their own campaigns", drop "Users can delete their campaigns"
DROP POLICY IF EXISTS "Users can delete their campaigns" ON public.email_campaigns;

-- Keep "Users can insert their own campaigns", drop "Users can insert campaigns"
DROP POLICY IF EXISTS "Users can insert campaigns" ON public.email_campaigns;

-- Keep "Users can update their own campaigns" but it's missing WITH CHECK, so drop both and recreate properly
DROP POLICY IF EXISTS "Users can update their campaigns" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.email_campaigns;

CREATE POLICY "Users can update their own campaigns"
ON public.email_campaigns
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Clean up duplicate RLS policies on email_templates table
-- Keep "Users can delete their own templates", drop "Users can delete their templates"
DROP POLICY IF EXISTS "Users can delete their templates" ON public.email_templates;

-- Keep "Users can insert their own templates", drop "Users can insert templates"
DROP POLICY IF EXISTS "Users can insert templates" ON public.email_templates;

-- Keep "Users can update their own templates" but ensure it has WITH CHECK, so drop both and recreate
DROP POLICY IF EXISTS "Users can update their templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON public.email_templates;

CREATE POLICY "Users can update their own templates"
ON public.email_templates
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);