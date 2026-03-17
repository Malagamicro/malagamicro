
-- Add all known login IPs to whitelist
INSERT INTO public.ip_whitelist (ip_address, reason, added_by)
SELECT DISTINCT ip_address, 'IP conocida de inicio de sesión legítimo', '38bd833c-3b85-4952-9f26-f03c67ccb160'::uuid
FROM public.user_login_logs
WHERE ip_address IS NOT NULL
ON CONFLICT (ip_address) DO NOTHING;

-- Deactivate all active security blocks
UPDATE public.login_security_blocks
SET is_active = false, resolved_at = now(), resolved_by = '38bd833c-3b85-4952-9f26-f03c67ccb160'::uuid
WHERE is_active = true;
