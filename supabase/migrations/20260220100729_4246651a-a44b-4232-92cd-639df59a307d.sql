-- Create storage bucket for ticket images/files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-files',
  'ticket-files',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Public read policy
CREATE POLICY "Public can view ticket files"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-files');

-- Auth upload policy  
CREATE POLICY "Authenticated users can upload ticket files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ticket-files' AND auth.uid() IS NOT NULL);

-- Auth delete policy
CREATE POLICY "Users can delete their ticket files"
ON storage.objects FOR DELETE
USING (bucket_id = 'ticket-files' AND auth.uid() IS NOT NULL);