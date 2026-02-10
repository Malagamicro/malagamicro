
-- Dashboard widget configuration per user
CREATE TABLE public.user_dashboard_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Sidebar configuration per user
CREATE TABLE public.user_sidebar_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_dashboard_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sidebar_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for dashboard config
CREATE POLICY "Users can view their own dashboard config" ON public.user_dashboard_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own dashboard config" ON public.user_dashboard_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own dashboard config" ON public.user_dashboard_config FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for sidebar config
CREATE POLICY "Users can view their own sidebar config" ON public.user_sidebar_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sidebar config" ON public.user_sidebar_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sidebar config" ON public.user_sidebar_config FOR UPDATE USING (auth.uid() = user_id);

-- Timestamps trigger
CREATE TRIGGER update_user_dashboard_config_updated_at BEFORE UPDATE ON public.user_dashboard_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_sidebar_config_updated_at BEFORE UPDATE ON public.user_sidebar_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
