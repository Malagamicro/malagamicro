
-- Add target_user_ids to general_reminders for assigning reminders to specific users
ALTER TABLE public.general_reminders ADD COLUMN IF NOT EXISTS target_user_ids uuid[] DEFAULT '{}';

-- Add is_admin_only to message_templates for admin-only templates
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS is_admin_only boolean DEFAULT false;

-- Update RLS for general_reminders: users can see reminders assigned to them
DROP POLICY IF EXISTS "Users can view their own general reminders" ON public.general_reminders;
CREATE POLICY "Users can view own or assigned reminders"
  ON public.general_reminders FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = ANY(target_user_ids));

-- Update RLS for message_templates: all authenticated users can view non-admin templates
DROP POLICY IF EXISTS "Users can view their own templates" ON public.message_templates;
CREATE POLICY "Users can view accessible templates"
  ON public.message_templates FOR SELECT
  USING (
    auth.uid() = user_id 
    OR (is_admin_only = false)
    OR (is_admin_only = true AND has_role(auth.uid(), 'admin'))
  );
