
-- Fix osticket_tickets: restrict SELECT to owner + admins instead of all authenticated
DROP POLICY IF EXISTS "Users can view osticket tickets" ON public.osticket_tickets;
DROP POLICY IF EXISTS "Authenticated users can view tickets" ON public.osticket_tickets;

CREATE POLICY "Users can view own tickets or admins all"
ON public.osticket_tickets
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')
);

-- Remove duplicate DELETE policies if any
DROP POLICY IF EXISTS "Users can delete osticket tickets" ON public.osticket_tickets;
DROP POLICY IF EXISTS "Users can delete their own tickets" ON public.osticket_tickets;
DROP POLICY IF EXISTS "Admins can delete tickets" ON public.osticket_tickets;

CREATE POLICY "Users can delete own tickets"
ON public.osticket_tickets
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any ticket"
ON public.osticket_tickets
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
