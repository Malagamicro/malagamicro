
-- ============================================================
-- SECURITY AUDIT FIX - Resolución de brechas críticas de seguridad
-- ============================================================

-- ============================================================
-- 1. PROFILES: ya tienen RLS - los usuarios del chat interno
--    necesitan ver los perfiles de sus compañeros, se mantiene
--    el acceso READ para usuarios autenticados (es un sistema interno)
--    pero aseguramos INSERT/UPDATE/DELETE solo al propietario
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.profiles FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 2. USER_PRESENCE: Restringir escritura solo al propio usuario
--    (necesitamos leer presencia de compañeros para el widget)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_presence' AND policyname='Users can insert own presence'
  ) THEN
    CREATE POLICY "Users can insert own presence"
      ON public.user_presence FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_presence' AND policyname='Users can update own presence'
  ) THEN
    CREATE POLICY "Users can update own presence"
      ON public.user_presence FOR UPDATE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_presence' AND policyname='Users can delete own presence'
  ) THEN
    CREATE POLICY "Users can delete own presence"
      ON public.user_presence FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 3. EMAIL_PROFILES: CRÍTICO - Credenciales SMTP/IMAP expuestas
--    Eliminar política permisiva y crear políticas restrictivas
-- ============================================================
ALTER TABLE public.email_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all email profiles" ON public.email_profiles;
DROP POLICY IF EXISTS "Email profiles are viewable by authenticated users" ON public.email_profiles;
DROP POLICY IF EXISTS "Users can view all email profiles" ON public.email_profiles;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='email_profiles' AND policyname='Users can view own email profiles'
  ) THEN
    CREATE POLICY "Users can view own email profiles"
      ON public.email_profiles FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='email_profiles' AND policyname='Users can insert own email profiles'
  ) THEN
    CREATE POLICY "Users can insert own email profiles"
      ON public.email_profiles FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='email_profiles' AND policyname='Users can update own email profiles'
  ) THEN
    CREATE POLICY "Users can update own email profiles"
      ON public.email_profiles FOR UPDATE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='email_profiles' AND policyname='Users can delete own email profiles'
  ) THEN
    CREATE POLICY "Users can delete own email profiles"
      ON public.email_profiles FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 4. OSTICKET_TICKETS: Eliminar política que expone todos los tickets
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view all tickets" ON public.osticket_tickets;
DROP POLICY IF EXISTS "Todos los usuarios autenticados pueden ver tickets" ON public.osticket_tickets;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='osticket_tickets' AND policyname='Users can view own tickets'
  ) THEN
    CREATE POLICY "Users can view own tickets"
      ON public.osticket_tickets FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='osticket_tickets' AND policyname='Admins can view all osticket tickets'
  ) THEN
    CREATE POLICY "Admins can view all osticket tickets"
      ON public.osticket_tickets FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='osticket_tickets' AND policyname='Users can insert own tickets'
  ) THEN
    CREATE POLICY "Users can insert own tickets"
      ON public.osticket_tickets FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='osticket_tickets' AND policyname='Users can update own tickets'
  ) THEN
    CREATE POLICY "Users can update own tickets"
      ON public.osticket_tickets FOR UPDATE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 5. ACTIVE_CALLS: Restringir UPDATE solo al propio caller
-- ============================================================
DROP POLICY IF EXISTS "Users can update calls" ON public.active_calls;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='active_calls' AND policyname='Callers can update own calls'
  ) THEN
    CREATE POLICY "Callers can update own calls"
      ON public.active_calls FOR UPDATE TO authenticated
      USING (auth.uid() = caller_id);
  END IF;
END $$;

-- ============================================================
-- 6. SHARED_FILES: Restringir UPDATE/INSERT/DELETE al propietario
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can update shared files" ON public.shared_files;
DROP POLICY IF EXISTS "Users can update any shared file" ON public.shared_files;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='shared_files' AND policyname='Users can update own shared files'
  ) THEN
    CREATE POLICY "Users can update own shared files"
      ON public.shared_files FOR UPDATE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='shared_files' AND policyname='Users can insert own shared files'
  ) THEN
    CREATE POLICY "Users can insert own shared files"
      ON public.shared_files FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='shared_files' AND policyname='Users can delete own shared files'
  ) THEN
    CREATE POLICY "Users can delete own shared files"
      ON public.shared_files FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 7. MESSAGE_TEMPLATES: Asegurar RLS y políticas
-- ============================================================
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='message_templates' AND policyname='Users can manage own message templates'
  ) THEN
    CREATE POLICY "Users can manage own message templates"
      ON public.message_templates FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 8. PROVIDERS: Asegurar RLS habilitado y políticas correctas
-- ============================================================
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='providers' AND policyname='Users can manage own providers'
  ) THEN
    CREATE POLICY "Users can manage own providers"
      ON public.providers FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 9. BUDGET_REQUESTS: Asegurar RLS habilitado y políticas
-- ============================================================
ALTER TABLE public.budget_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='budget_requests' AND policyname='Users can manage own budget requests'
  ) THEN
    CREATE POLICY "Users can manage own budget requests"
      ON public.budget_requests FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='budget_requests' AND policyname='Admins can view all budget requests'
  ) THEN
    CREATE POLICY "Admins can view all budget requests"
      ON public.budget_requests FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- ============================================================
-- 10. OSTICKET_CONFIG: Asegurar RLS habilitado
-- ============================================================
ALTER TABLE public.osticket_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='osticket_config' AND policyname='Users can manage own osticket config'
  ) THEN
    CREATE POLICY "Users can manage own osticket config"
      ON public.osticket_config FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
