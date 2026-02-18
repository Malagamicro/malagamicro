
-- Create security definer function to check event participation without triggering RLS
CREATE OR REPLACE FUNCTION public.is_event_participant(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = _event_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_event_editor(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = _event_id AND user_id = _user_id AND permission = 'edit'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_event_creator(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_events
    WHERE id = _event_id AND creator_id = _user_id
  )
$$;

-- Fix calendar_events policies
DROP POLICY IF EXISTS "Participants can view shared events" ON public.calendar_events;
DROP POLICY IF EXISTS "Editors can update shared events" ON public.calendar_events;

CREATE POLICY "Participants can view shared events"
ON public.calendar_events FOR SELECT
USING (public.is_event_participant(id, auth.uid()));

CREATE POLICY "Editors can update shared events"
ON public.calendar_events FOR UPDATE
USING (public.is_event_editor(id, auth.uid()));

-- Fix event_participants policy that references calendar_events
DROP POLICY IF EXISTS "Event creator manages participants" ON public.event_participants;

CREATE POLICY "Event creator manages participants"
ON public.event_participants FOR ALL
USING (public.is_event_creator(event_id, auth.uid()))
WITH CHECK (public.is_event_creator(event_id, auth.uid()));
