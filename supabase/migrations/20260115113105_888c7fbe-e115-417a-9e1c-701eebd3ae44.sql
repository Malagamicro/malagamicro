-- Comprehensive RLS policy cleanup - remove old permissive policies

-- LEADS TABLE: Remove old permissive policies (keep the restrictive ones we want)
DROP POLICY IF EXISTS "Users can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads" ON public.leads;

-- LEAD_ACTIVITIES TABLE: Remove old permissive policy
DROP POLICY IF EXISTS "Users can view all activities" ON public.lead_activities;

-- EMAIL_TEMPLATES TABLE: Remove old permissive policy  
DROP POLICY IF EXISTS "Users can view all templates" ON public.email_templates;

-- EMAIL_CAMPAIGNS TABLE: Remove old permissive policy
DROP POLICY IF EXISTS "Users can view all campaigns" ON public.email_campaigns;

-- PROFILES TABLE: Remove old permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;