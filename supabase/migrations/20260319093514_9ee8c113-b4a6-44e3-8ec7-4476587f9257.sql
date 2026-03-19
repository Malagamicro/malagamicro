
CREATE TABLE public.botqueron_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  service TEXT DEFAULT 'Consulta Agente IA',
  notes TEXT,
  status TEXT DEFAULT 'pendiente',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.botqueron_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all botqueron appointments"
  ON public.botqueron_appointments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert botqueron appointments"
  ON public.botqueron_appointments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update botqueron appointments"
  ON public.botqueron_appointments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete botqueron appointments"
  ON public.botqueron_appointments FOR DELETE TO authenticated USING (true);

-- Allow anon inserts for n8n webhook
CREATE POLICY "Anon can insert botqueron appointments"
  ON public.botqueron_appointments FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can read botqueron appointments"
  ON public.botqueron_appointments FOR SELECT TO anon USING (true);
