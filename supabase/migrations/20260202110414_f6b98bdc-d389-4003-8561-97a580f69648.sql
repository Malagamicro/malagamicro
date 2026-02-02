-- Fix: Restrict shared_folders SELECT policy to owner-only access
-- Currently has "Authenticated users can view shared folders" with USING (true)
-- This allows any authenticated user to see all folders - a privacy violation

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view shared folders" ON public.shared_folders;

-- Create owner-only SELECT policy
CREATE POLICY "Users can view their own shared folders" 
ON public.shared_folders 
FOR SELECT 
USING (auth.uid() = user_id);