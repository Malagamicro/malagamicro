
-- ============================================
-- 1. CALENDAR EVENTS (sin policies que referencien event_participants)
-- ============================================
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  all_day BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#3b82f6',
  reminder_minutes INTEGER DEFAULT 15,
  creator_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators manage their events" ON public.calendar_events
  FOR ALL USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- ============================================
-- 2. EVENT PARTICIPANTS
-- ============================================
CREATE TABLE public.event_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event creator manages participants" ON public.event_participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.calendar_events ce WHERE ce.id = event_id AND ce.creator_id = auth.uid())
  );

CREATE POLICY "Users see own participation" ON public.event_participants
  FOR SELECT USING (auth.uid() = user_id);

-- Now add policies on calendar_events that reference event_participants
CREATE POLICY "Participants can view shared events" ON public.calendar_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_participants ep WHERE ep.event_id = id AND ep.user_id = auth.uid())
  );

CREATE POLICY "Editors can update shared events" ON public.calendar_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.event_participants ep WHERE ep.event_id = id AND ep.user_id = auth.uid() AND ep.permission = 'edit')
  );

-- ============================================
-- 3. EXIT RECORDS
-- ============================================
CREATE TABLE public.exit_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  student_name TEXT NOT NULL,
  exit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  exit_time TIME,
  return_time TIME,
  reason TEXT NOT NULL,
  destination TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exit_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own exit records" ON public.exit_records
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all exit records" ON public.exit_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- ============================================
-- 4. REPORTS
-- ============================================
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'exit_report',
  status TEXT NOT NULL DEFAULT 'generated',
  generated_by UUID NOT NULL,
  recipient_id UUID,
  week_start DATE,
  week_end DATE,
  source_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reports" ON public.reports
  FOR ALL USING (auth.uid() = generated_by)
  WITH CHECK (auth.uid() = generated_by);

CREATE POLICY "Recipients view their reports" ON public.reports
  FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "Admins view all reports" ON public.reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exit_records_updated_at
  BEFORE UPDATE ON public.exit_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_participants;
