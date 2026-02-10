
-- Table to signal active calls between users
CREATE TABLE public.active_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  caller_id UUID NOT NULL,
  caller_name TEXT NOT NULL,
  room_name TEXT NOT NULL,
  is_video BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'ringing', -- ringing, accepted, ended
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.active_calls ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see active calls (needed for realtime notifications)
CREATE POLICY "Authenticated users can view active calls"
  ON public.active_calls FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can create calls
CREATE POLICY "Users can create calls"
  ON public.active_calls FOR INSERT
  WITH CHECK (auth.uid() = caller_id);

-- Users can update call status (accept/end)
CREATE POLICY "Users can update calls"
  ON public.active_calls FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Callers can delete their calls
CREATE POLICY "Callers can delete calls"
  ON public.active_calls FOR DELETE
  USING (auth.uid() = caller_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_calls;
