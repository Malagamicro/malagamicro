
-- Add is_shared column to ai_memory
ALTER TABLE public.ai_memory ADD COLUMN is_shared boolean NOT NULL DEFAULT false;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own memories" ON public.ai_memory;

-- New SELECT policy: own memories + shared memories from anyone
CREATE POLICY "Users can view own and shared memories"
ON public.ai_memory FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_shared = true);
