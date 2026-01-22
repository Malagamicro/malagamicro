-- FASE 2.2: Sistema de Carpetas para Leads

-- 1. Crear tabla de carpetas
CREATE TABLE public.lead_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.lead_folders ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para lead_folders
CREATE POLICY "Users can view their own folders"
ON public.lead_folders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folders"
ON public.lead_folders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
ON public.lead_folders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
ON public.lead_folders FOR DELETE
USING (auth.uid() = user_id);

-- 4. Trigger para actualizar updated_at
CREATE TRIGGER update_lead_folders_updated_at
BEFORE UPDATE ON public.lead_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Añadir columna folder_id a leads (nullable, para leads sin carpeta)
ALTER TABLE public.leads 
ADD COLUMN folder_id UUID REFERENCES public.lead_folders(id) ON DELETE SET NULL;

-- 6. Índice para mejorar filtrado por carpeta
CREATE INDEX idx_leads_folder_id ON public.leads(folder_id);
CREATE INDEX idx_lead_folders_user_id ON public.lead_folders(user_id);