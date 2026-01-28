-- Create shared-files bucket for team file sharing
INSERT INTO storage.buckets (id, name, public)
VALUES ('shared-files', 'shared-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to shared-files bucket
CREATE POLICY "Authenticated users can upload shared files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shared-files');

-- Allow authenticated users to view/download shared files
CREATE POLICY "Authenticated users can view shared files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'shared-files');

-- Allow authenticated users to delete their own shared files
CREATE POLICY "Authenticated users can delete shared files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'shared-files');

-- Fix chat-files bucket: make it public for downloads
UPDATE storage.buckets SET public = true WHERE id = 'chat-files';

-- Add policies for chat-files bucket if not exists
DO $$
BEGIN
    -- Check and create INSERT policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated users can upload chat files'
    ) THEN
        CREATE POLICY "Authenticated users can upload chat files"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'chat-files');
    END IF;
    
    -- Check and create SELECT policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated users can view chat files'
    ) THEN
        CREATE POLICY "Authenticated users can view chat files"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (bucket_id = 'chat-files');
    END IF;
END $$;

-- Create table to track shared files metadata
CREATE TABLE IF NOT EXISTS public.shared_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT,
    description TEXT,
    folder_path TEXT DEFAULT '/',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view shared files
CREATE POLICY "Authenticated users can view shared files metadata"
ON public.shared_files FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own files
CREATE POLICY "Users can insert their own shared files"
ON public.shared_files FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own files
CREATE POLICY "Users can update their own shared files"
ON public.shared_files FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own files
CREATE POLICY "Users can delete their own shared files"
ON public.shared_files FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_shared_files_updated_at
BEFORE UPDATE ON public.shared_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_files;