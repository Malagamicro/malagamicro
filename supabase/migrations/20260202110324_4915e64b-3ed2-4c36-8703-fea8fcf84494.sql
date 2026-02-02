-- Fix: Restrict shared_files SELECT policy to owner-only access
-- Currently has "Authenticated users can view shared files metadata" with USING (true)
-- This allows any authenticated user to see all files - a privacy violation

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view shared files metadata" ON public.shared_files;

-- Create owner-only SELECT policy
CREATE POLICY "Users can view their own shared files" 
ON public.shared_files 
FOR SELECT 
USING (auth.uid() = user_id);