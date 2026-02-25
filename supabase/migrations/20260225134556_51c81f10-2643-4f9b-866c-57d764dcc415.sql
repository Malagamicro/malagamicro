
CREATE TABLE public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  memory_key text NOT NULL,
  memory_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_memory_user ON public.ai_memory(user_id);
CREATE INDEX idx_ai_memory_lead ON public.ai_memory(lead_id);
CREATE INDEX idx_ai_memory_category ON public.ai_memory(category);

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memories" ON public.ai_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own memories" ON public.ai_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own memories" ON public.ai_memory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own memories" ON public.ai_memory FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_memory_updated_at BEFORE UPDATE ON public.ai_memory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
