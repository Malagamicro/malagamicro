import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface OsTicketConfig {
  id: string;
  user_id: string;
  osticket_url: string;
  api_key: string;
  notification_numbers: string[];
  message_template: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OsTicketConfigInput {
  osticket_url: string;
  api_key: string;
  notification_numbers: string[];
  message_template: string;
  is_enabled: boolean;
}

const DEFAULT_TEMPLATE = `🎫 *Nuevo Ticket de Soporte*

📋 *Ticket:* {{number}}
👤 *Cliente:* {{name}}
📧 *Email:* {{email}}
🏢 *Departamento:* {{department}}
⚡ *Prioridad:* {{priority}}

📝 *Asunto:* {{subject}}

💬 *Mensaje:*
{{message}}

🔗 Ver en osTicket: {{ticket_url}}`;

export function useOsTicketConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['osticket-config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await (supabase as any)
        .from('osticket_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as OsTicketConfig | null;
    },
    enabled: !!user?.id,
  });

  const { mutate: saveConfig, isPending: isSaving } = useMutation({
    mutationFn: async (input: OsTicketConfigInput) => {
      if (!user?.id) throw new Error('No user');

      if (config?.id) {
        // Update existing
        const { data, error } = await (supabase as any)
          .from('osticket_config')
          .update(input)
          .eq('id', config.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await (supabase as any)
          .from('osticket_config')
          .insert({ ...input, user_id: user.id })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['osticket-config'] });
      toast.success('Configuración de osTicket guardada');
    },
    onError: (error: Error) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });

  const { mutate: toggleEnabled, isPending: isToggling } = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!config?.id) throw new Error('No config exists');

      const { error } = await (supabase as any)
        .from('osticket_config')
        .update({ is_enabled: enabled })
        .eq('id', config.id);

      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['osticket-config'] });
      toast.success(enabled ? 'Integración activada' : 'Integración desactivada');
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  return {
    config,
    isLoading,
    saveConfig,
    isSaving,
    toggleEnabled,
    isToggling,
    defaultTemplate: DEFAULT_TEMPLATE,
  };
}
