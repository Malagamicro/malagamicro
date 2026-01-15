-- Fix remaining RLS policies for email_campaigns

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can update their campaigns" ON public.email_campaigns;

-- Recreate with proper restrictions
CREATE POLICY "Users can update their campaigns" ON public.email_campaigns 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- PROFILES TABLE: Fix SELECT policy (if previous migration didn't complete this part)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);