
-- Add recurrence, snooze, linked entity and note fields to general_reminders
ALTER TABLE public.general_reminders
  ADD COLUMN IF NOT EXISTS recurrence_type text NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS snooze_until timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS linked_entity_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS linked_entity_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS note text DEFAULT NULL;
