-- Drop existing restrictive SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policy allowing all authenticated users to view all profiles
-- This is necessary for internal chat to show user lists and participant names
CREATE POLICY "Authenticated users can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Keep the existing update policy (users can only update their own profile)
-- The INSERT policy with trigger handles profile creation on signup