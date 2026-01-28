-- Create shared_folders table
CREATE TABLE IF NOT EXISTS public.shared_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.shared_folders(id) ON DELETE CASCADE,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.shared_folders ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view shared folders
CREATE POLICY "Authenticated users can view shared folders"
ON public.shared_folders FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own folders
CREATE POLICY "Users can insert their own shared folders"
ON public.shared_folders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own folders
CREATE POLICY "Users can update their own shared folders"
ON public.shared_folders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own folders
CREATE POLICY "Users can delete their own shared folders"
ON public.shared_folders FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_shared_folders_updated_at
BEFORE UPDATE ON public.shared_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add folder_id to shared_files (replace folder_path)
ALTER TABLE public.shared_files ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.shared_folders(id) ON DELETE SET NULL;

-- Enable realtime for folders
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_folders;