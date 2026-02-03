-- 1. Tabla para solicitudes de presupuesto
CREATE TABLE public.budget_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  products JSONB NOT NULL DEFAULT '[]'::jsonb,
  email_empresa TEXT DEFAULT 'presupuestos@malagamicro.com',
  request_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'error')),
  emails_preview JSONB,
  response_data JSONB
);

-- 2. Tabla para notificaciones de presupuestos
CREATE TABLE public.budget_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('success', 'warning', 'info', 'error')),
  read BOOLEAN NOT NULL DEFAULT false,
  request_id TEXT,
  metadata JSONB,
  invoice_url TEXT
);

-- 3. Tabla para presupuestos recibidos
CREATE TABLE public.budgets_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  request_id TEXT NOT NULL,
  proveedor TEXT NOT NULL,
  email_proveedor TEXT NOT NULL,
  productos JSONB NOT NULL DEFAULT '[]'::jsonb,
  total DECIMAL(12,2),
  observaciones TEXT,
  fecha_recepcion TIMESTAMP WITH TIME ZONE DEFAULT now(),
  selected BOOLEAN NOT NULL DEFAULT false,
  invoice_id TEXT,
  user_responsible UUID NOT NULL
);

-- 4. Tabla para logs del workflow
CREATE TABLE public.workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  error_details TEXT,
  request_id TEXT,
  node_error TEXT,
  metadata JSONB
);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.budget_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para budget_requests
CREATE POLICY "Users can view their own requests" ON public.budget_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own requests" ON public.budget_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own requests" ON public.budget_requests
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins pueden ver todas las solicitudes
CREATE POLICY "Admins can view all requests" ON public.budget_requests
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all requests" ON public.budget_requests
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Políticas para budget_notifications
CREATE POLICY "Users can view their own notifications" ON public.budget_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.budget_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para budgets_received (solo responsables y admins)
CREATE POLICY "Responsible users can view their budgets" ON public.budgets_received
  FOR SELECT USING (auth.uid() = user_responsible);

CREATE POLICY "Admins can view all budgets" ON public.budgets_received
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Responsible can update their budgets" ON public.budgets_received
  FOR UPDATE USING (auth.uid() = user_responsible);

-- Políticas para workflow_logs (solo admins)
CREATE POLICY "Admins can view all logs" ON public.workflow_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_budget_requests_updated_at
  BEFORE UPDATE ON public.budget_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();