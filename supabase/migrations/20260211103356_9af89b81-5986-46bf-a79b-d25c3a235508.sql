
-- Add sort_order column to shared_files for drag-and-drop reordering
ALTER TABLE public.shared_files ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Create index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_shared_files_sort_order ON public.shared_files (folder_id, sort_order);

-- Allow any authenticated user to update folder_id and sort_order (move/reorder files)
CREATE POLICY "Any authenticated user can move/reorder files"
ON public.shared_files
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
