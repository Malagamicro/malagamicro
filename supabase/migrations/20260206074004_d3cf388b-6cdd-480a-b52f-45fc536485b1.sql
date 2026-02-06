-- Tabla de proveedores con catálogo
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  especialidad TEXT[] DEFAULT '{}',
  notas TEXT,
  activo BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID NOT NULL
);

-- Índice único para nombre+user_id para evitar duplicados por usuario
CREATE UNIQUE INDEX IF NOT EXISTS providers_nombre_user_idx ON public.providers(nombre, user_id);

-- Enable RLS
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- RLS Policies para providers
CREATE POLICY "Users can view their own providers" 
ON public.providers FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own providers" 
ON public.providers FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own providers" 
ON public.providers FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own providers" 
ON public.providers FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_providers_updated_at
BEFORE UPDATE ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Añadir columnas faltantes a budget_requests si no existen
ALTER TABLE public.budget_requests 
ADD COLUMN IF NOT EXISTS solicitud_original TEXT;

-- Añadir columnas faltantes a budgets_received
ALTER TABLE public.budgets_received 
ADD COLUMN IF NOT EXISTS validez TEXT,
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'revision',
ADD COLUMN IF NOT EXISTS email_original TEXT,
ADD COLUMN IF NOT EXISTS stel_budget_id TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Habilitar Realtime para budgets_received
ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets_received;

-- Habilitar Realtime para providers
ALTER PUBLICATION supabase_realtime ADD TABLE public.providers;