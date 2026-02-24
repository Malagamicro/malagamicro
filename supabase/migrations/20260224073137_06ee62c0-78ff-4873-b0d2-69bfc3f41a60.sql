-- Allow all authenticated users to delete calendar events they can see
-- (creators via existing ALL policy, and now also participants with edit permission)
CREATE POLICY "Editors can delete shared events"
ON public.calendar_events
FOR DELETE
USING (is_event_editor(id, auth.uid()));