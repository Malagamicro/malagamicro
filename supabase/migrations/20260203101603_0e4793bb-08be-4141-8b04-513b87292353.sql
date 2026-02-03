-- Allow admin users to delete any osTicket ticket history row
-- This fixes "no se puede limpiar el historial" when tickets were created under another user's config.

CREATE POLICY "Admins can delete all osticket tickets"
ON public.osticket_tickets
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
