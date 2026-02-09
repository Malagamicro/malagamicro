-- Tabla para almacenar artículos SEO generados por n8n
CREATE TABLE public.seo_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  image_count INTEGER DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending',
  workflow_id TEXT,
  
  -- Datos del artículo generado
  title TEXT,
  slug TEXT,
  meta_description TEXT,
  keywords JSONB DEFAULT '[]'::jsonb,
  html_content TEXT,
  structured_data JSONB,
  meta_tags JSONB,
  
  -- Research y métricas
  research_summary TEXT,
  seo_score INTEGER,
  word_count INTEGER,
  security_score INTEGER,
  
  -- Imágenes generadas
  images JSONB DEFAULT '[]'::jsonb,
  images_success_count INTEGER DEFAULT 0,
  images_failed_count INTEGER DEFAULT 0,
  
  -- Optimizaciones
  optimizations JSONB DEFAULT '[]'::jsonb,
  suggested_links JSONB DEFAULT '[]'::jsonb,
  
  -- Error handling
  error_message TEXT,
  error_details JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.seo_articles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para acceso de usuarios a sus propios artículos
CREATE POLICY "Users can view their own SEO articles"
ON public.seo_articles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own SEO articles"
ON public.seo_articles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SEO articles"
ON public.seo_articles
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SEO articles"
ON public.seo_articles
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_seo_articles_updated_at
BEFORE UPDATE ON public.seo_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para mejorar rendimiento
CREATE INDEX idx_seo_articles_user_id ON public.seo_articles(user_id);
CREATE INDEX idx_seo_articles_status ON public.seo_articles(status);
CREATE INDEX idx_seo_articles_created_at ON public.seo_articles(created_at DESC);

-- Habilitar realtime para ver actualizaciones en vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.seo_articles;