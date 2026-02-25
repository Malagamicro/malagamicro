
-- Add google_place_id column for deduplication from Google Maps prospection
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS google_place_id text;

-- Create unique index per user to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_google_place_id_user 
ON public.leads (user_id, google_place_id) 
WHERE google_place_id IS NOT NULL;
