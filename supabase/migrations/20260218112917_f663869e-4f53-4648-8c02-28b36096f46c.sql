
-- Drop broken policies
DROP POLICY IF EXISTS "Participants can view shared events" ON public.calendar_events;
DROP POLICY IF EXISTS "Editors can update shared events" ON public.calendar_events;

-- Recreate with correct reference
CREATE POLICY "Participants can view shared events"
ON public.calendar_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_participants ep
    WHERE ep.event_id = calendar_events.id AND ep.user_id = auth.uid()
  )
);

CREATE POLICY "Editors can update shared events"
ON public.calendar_events
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.event_participants ep
    WHERE ep.event_id = calendar_events.id AND ep.user_id = auth.uid() AND ep.permission = 'edit'
  )
);
