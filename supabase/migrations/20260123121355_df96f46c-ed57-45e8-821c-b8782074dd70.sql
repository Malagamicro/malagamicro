-- Add phone verification fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS phone_type TEXT DEFAULT 'unknown' CHECK (phone_type IN ('mobile', 'landline', 'unknown')),
ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mobile_phone TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.leads.phone_type IS 'Type of phone: mobile, landline, or unknown';
COMMENT ON COLUMN public.leads.whatsapp_verified IS 'Whether WhatsApp verification passed (true/false/null for not checked)';
COMMENT ON COLUMN public.leads.mobile_phone IS 'Mobile phone found via enrichment if original was landline';