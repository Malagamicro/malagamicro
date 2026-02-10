
-- Create storage bucket for SEO article images
INSERT INTO storage.buckets (id, name, public) VALUES ('seo-images', 'seo-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read SEO images (public)
CREATE POLICY "SEO images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'seo-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload SEO images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'seo-images' AND auth.role() = 'authenticated');

-- Allow service role to upload (for edge functions)
CREATE POLICY "Service role can manage SEO images"
ON storage.objects FOR ALL
USING (bucket_id = 'seo-images')
WITH CHECK (bucket_id = 'seo-images');
