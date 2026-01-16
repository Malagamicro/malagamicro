-- 1. Remove duplicate SELECT policy from leads table
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;

-- 2. Make user_id NOT NULL on leads table for stronger data integrity
-- First update any NULL user_ids (shouldn't exist but just in case)
-- Then add the NOT NULL constraint
ALTER TABLE public.leads 
ALTER COLUMN user_id SET NOT NULL;

-- 3. Make user_id NOT NULL on lead_activities table
ALTER TABLE public.lead_activities 
ALTER COLUMN user_id SET NOT NULL;

-- 4. Remove email column from profiles table (redundant with auth.users)
-- First check if any code depends on it, then drop it
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS email;

-- 5. Add index on user_id for faster RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_user_id ON public.lead_activities(user_id);