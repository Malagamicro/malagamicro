
-- FIX CRITICAL: Remove overly permissive SELECT policy on email_profiles that exposes SMTP/IMAP passwords
DROP POLICY IF EXISTS "All authenticated users can view email profiles" ON public.email_profiles;
