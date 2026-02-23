-- Allow users to see their own roles (needed for client-side role checks)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);
