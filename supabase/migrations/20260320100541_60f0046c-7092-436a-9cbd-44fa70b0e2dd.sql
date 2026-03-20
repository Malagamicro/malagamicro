
CREATE TABLE public.botqueron_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  created_by TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.botqueron_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read knowledge" ON public.botqueron_knowledge
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert knowledge" ON public.botqueron_knowledge
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update knowledge" ON public.botqueron_knowledge
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete knowledge" ON public.botqueron_knowledge
  FOR DELETE TO authenticated USING (true);

-- Allow anon access for n8n RAG queries
CREATE POLICY "Anon can read knowledge for RAG" ON public.botqueron_knowledge
  FOR SELECT TO anon USING (true);
