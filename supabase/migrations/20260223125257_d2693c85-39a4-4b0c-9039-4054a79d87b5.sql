-- Table for internal team notes on osTicket tickets
CREATE TABLE public.ticket_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id text NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_notes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view notes (team collaboration)
CREATE POLICY "Authenticated users can view ticket notes"
ON public.ticket_notes FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can insert their own notes
CREATE POLICY "Users can insert their own notes"
ON public.ticket_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
ON public.ticket_notes FOR DELETE
USING (auth.uid() = user_id);

-- Admins can delete any note
CREATE POLICY "Admins can delete any note"
ON public.ticket_notes FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Index for fast lookups
CREATE INDEX idx_ticket_notes_ticket_id ON public.ticket_notes (ticket_id);

-- Enable realtime for live collaboration
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_notes;
