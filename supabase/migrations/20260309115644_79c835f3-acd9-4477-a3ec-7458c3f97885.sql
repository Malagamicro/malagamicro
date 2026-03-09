
-- Allow assigned users (in target_user_ids) to update reminders
DROP POLICY IF EXISTS "Assigned users can update reminders" ON public.general_reminders;
CREATE POLICY "Assigned users can update reminders"
ON public.general_reminders
FOR UPDATE
TO public
USING (auth.uid() = ANY (target_user_ids))
WITH CHECK (auth.uid() = ANY (target_user_ids));
