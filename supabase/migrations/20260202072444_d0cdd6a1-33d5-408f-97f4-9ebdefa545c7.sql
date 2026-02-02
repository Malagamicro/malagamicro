-- Create osticket_config table for integration settings
CREATE TABLE public.osticket_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  osticket_url TEXT NOT NULL DEFAULT 'https://soporte.malagamicro.com',
  api_key TEXT NOT NULL DEFAULT '',
  notification_numbers TEXT[] NOT NULL DEFAULT '{}',
  message_template TEXT NOT NULL DEFAULT '🎫 *Nuevo Ticket de Soporte*

📋 *Ticket:* {{number}}
👤 *Cliente:* {{name}}
📧 *Email:* {{email}}
🏢 *Departamento:* {{department}}
⚡ *Prioridad:* {{priority}}

📝 *Asunto:* {{subject}}

💬 *Mensaje:*
{{message}}

🔗 Ver en osTicket: {{ticket_url}}',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.osticket_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own osticket config"
  ON public.osticket_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own osticket config"
  ON public.osticket_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own osticket config"
  ON public.osticket_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own osticket config"
  ON public.osticket_config FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_osticket_config_updated_at
  BEFORE UPDATE ON public.osticket_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();