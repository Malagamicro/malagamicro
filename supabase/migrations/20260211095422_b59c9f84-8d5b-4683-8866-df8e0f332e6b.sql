
-- Clean up duplicate general_reminders policies
DROP POLICY IF EXISTS "Users can create reminders" ON public.general_reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON public.general_reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON public.general_reminders;
DROP POLICY IF EXISTS "Authenticated users can view all reminders" ON public.general_reminders;
