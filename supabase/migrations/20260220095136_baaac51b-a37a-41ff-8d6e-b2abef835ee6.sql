ALTER TABLE public.osticket_config 
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT 'https://malagamicro.lovable.app/images/nuevo-ticket.png',
  ADD COLUMN IF NOT EXISTS send_image BOOLEAN NOT NULL DEFAULT true;