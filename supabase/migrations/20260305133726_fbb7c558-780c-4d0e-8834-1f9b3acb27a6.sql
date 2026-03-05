
-- Table for per-user completion tracking of shared reminders
CREATE TABLE public.general_reminder_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.general_reminders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(reminder_id, user_id)
);

ALTER TABLE public.general_reminder_completions ENABLE ROW LEVEL SECURITY;

-- Users can view their own completions
CREATE POLICY "Users can view own completions"
  ON public.general_reminder_completions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own completions
CREATE POLICY "Users can insert own completions"
  ON public.general_reminder_completions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own completions (to uncomplete)
CREATE POLICY "Users can delete own completions"
  ON public.general_reminder_completions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
