-- Create table for osTicket history
CREATE TABLE public.osticket_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticket_id TEXT,
  ticket_number TEXT,
  subject TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  department TEXT,
  priority TEXT,
  message TEXT,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.osticket_tickets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own tickets"
ON public.osticket_tickets
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tickets"
ON public.osticket_tickets
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_osticket_tickets_user_created ON public.osticket_tickets(user_id, created_at DESC);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.osticket_tickets;