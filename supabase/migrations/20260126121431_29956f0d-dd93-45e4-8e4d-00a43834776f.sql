-- Create table to store Google Sheets configurations (multiple sheets per user)
CREATE TABLE public.google_sheets_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  sheet_name TEXT NOT NULL DEFAULT 'Hoja 1',
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_sync_interval INTEGER NOT NULL DEFAULT 10,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  custom_columns JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_sheets_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own configs" 
ON public.google_sheets_configs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own configs" 
ON public.google_sheets_configs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own configs" 
ON public.google_sheets_configs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own configs" 
ON public.google_sheets_configs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_google_sheets_configs_updated_at
BEFORE UPDATE ON public.google_sheets_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();