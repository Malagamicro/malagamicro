
-- Drop the existing policy that only allows own profiles
DROP POLICY IF EXISTS "Users can manage their own email profiles" ON public.email_profiles;

-- All authenticated users can SELECT all email profiles
CREATE POLICY "All authenticated users can view email profiles"
ON public.email_profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can only INSERT their own profiles
CREATE POLICY "Users can create their own email profiles"
ON public.email_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only UPDATE their own profiles
CREATE POLICY "Users can update their own email profiles"
ON public.email_profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only DELETE their own profiles
CREATE POLICY "Users can delete their own email profiles"
ON public.email_profiles FOR DELETE
USING (auth.uid() = user_id);
