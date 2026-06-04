-- Añadir columnas de video a seo_articles
ALTER TABLE public.seo_articles
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS video_prompt TEXT,
ADD COLUMN IF NOT EXISTS video_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS video_duration INTEGER;
