-- Fix remaining chat-files storage policies
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can delete their own chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own chat files" ON storage.objects;

-- Recreate owner-restricted policies for chat-files bucket
CREATE POLICY "Users can view their own chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own chat files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own chat files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own chat files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);