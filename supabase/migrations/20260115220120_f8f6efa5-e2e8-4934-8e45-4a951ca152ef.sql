-- Add explicit UPDATE/DELETE denial policies to audit_logs table
-- This ensures audit log immutability and prevents future policy mistakes

-- Prevent any updates to audit logs
CREATE POLICY "Audit logs cannot be updated"
ON public.audit_logs FOR UPDATE
USING (false);

-- Prevent any deletions of audit logs
CREATE POLICY "Audit logs cannot be deleted"
ON public.audit_logs FOR DELETE
USING (false);