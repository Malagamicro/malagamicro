import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AISubagentTeam {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  orchestrator_model: string;
  created_at: string;
  updated_at: string;
}

export interface AISubagent {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  model: string;
  role_prompt: string;
  agent_type: 'text' | 'image' | 'audio';
  avatar_emoji: string;
  avatar_color: string;
  is_active: boolean;
  team_id: string | null;
  tools: string[];
  created_at: string;
  updated_at: string;
}

// Available tools that can be assigned to subagents
export const AVAILABLE_TOOLS = [
  { id: 'search_leads', name: 'Buscar Leads', category: 'Leads', icon: '🔍' },
  { id: 'get_all_leads', name: 'Listar Leads', category: 'Leads', icon: '📋' },
  { id: 'get_lead_stats', name: 'Estadísticas Leads', category: 'Leads', icon: '📊' },
  { id: 'create_lead', name: 'Crear Lead', category: 'Leads', icon: '➕' },
  { id: 'update_lead', name: 'Actualizar Lead', category: 'Leads', icon: '✏️' },
  { id: 'delete_lead', name: 'Eliminar Lead', category: 'Leads', icon: '🗑️' },
  { id: 'get_recent_activities', name: 'Actividades Recientes', category: 'Actividad', icon: '📰' },
  { id: 'get_pending_reminders', name: 'Recordatorios Pendientes', category: 'Recordatorios', icon: '⏰' },
  { id: 'get_general_reminders', name: 'Recordatorios Generales', category: 'Recordatorios', icon: '📌' },
  { id: 'create_reminder', name: 'Crear Recordatorio', category: 'Recordatorios', icon: '🔔' },
  { id: 'complete_reminder', name: 'Completar Recordatorio', category: 'Recordatorios', icon: '✅' },
  { id: 'send_internal_message', name: 'Enviar Mensaje Interno', category: 'Comunicación', icon: '💬' },
  { id: 'get_team_users', name: 'Usuarios del Equipo', category: 'Comunicación', icon: '👥' },
  { id: 'get_unread_messages', name: 'Mensajes No Leídos', category: 'Comunicación', icon: '📩' },
  { id: 'get_message_templates', name: 'Plantillas Mensajes', category: 'Plantillas', icon: '📝' },
  { id: 'create_message_template', name: 'Crear Plantilla', category: 'Plantillas', icon: '📄' },
  { id: 'get_shared_files', name: 'Archivos Compartidos', category: 'Archivos', icon: '📁' },
  { id: 'get_shared_folders', name: 'Carpetas Compartidas', category: 'Archivos', icon: '📂' },
  { id: 'view_shared_file', name: 'Ver Archivo', category: 'Archivos', icon: '👁️' },
  { id: 'get_email_campaigns', name: 'Campañas Email', category: 'Email', icon: '📧' },
  { id: 'get_email_templates', name: 'Plantillas Email', category: 'Email', icon: '✉️' },
  { id: 'get_whatsapp_chats', name: 'Chats WhatsApp', category: 'WhatsApp', icon: '💚' },
  { id: 'get_whatsapp_messages', name: 'Mensajes WhatsApp', category: 'WhatsApp', icon: '📱' },
  { id: 'get_calendar_events', name: 'Ver Calendario', category: 'Calendario', icon: '📅' },
  { id: 'create_calendar_event', name: 'Crear Evento', category: 'Calendario', icon: '🗓️' },
  { id: 'share_calendar_event', name: 'Compartir Evento', category: 'Calendario', icon: '🔗' },
  { id: 'get_ai_memories', name: 'Memoria IA', category: 'IA', icon: '🧠' },
  { id: 'view_ai_memory_file', name: 'Archivos Memoria IA', category: 'IA', icon: '🗃️' },
  { id: 'get_osticket_tickets', name: 'Tickets Soporte', category: 'Soporte', icon: '🎫' },
  { id: 'get_audit_logs', name: 'Logs Auditoría', category: 'Auditoría', icon: '📜' },
  { id: 'get_lead_folders', name: 'Carpetas Leads', category: 'Leads', icon: '🗂️' },
  { id: 'send_notification', name: 'Enviar Notificación', category: 'Notificaciones', icon: '🔔' },
  { id: 'create_file', name: 'Crear Archivo', category: 'Archivos', icon: '📄' },
  { id: 'delete_shared_file', name: 'Eliminar Archivo', category: 'Archivos', icon: '🗑️' },
];

export function useAISubagents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ---- Teams ----
  const teamsQuery = useQuery({
    queryKey: ['ai-subagent-teams'],
    queryFn: async (): Promise<AISubagentTeam[]> => {
      const { data, error } = await supabase
        .from('ai_subagent_teams' as any)
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!user,
  });

  const createTeam = useMutation({
    mutationFn: async (team: { name: string; description?: string; orchestrator_model?: string }) => {
      if (!user?.id) throw new Error('No autenticado');
      const { data, error } = await supabase
        .from('ai_subagent_teams' as any)
        .insert({ ...team, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-subagent-teams'] });
      toast.success('Equipo creado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  const updateTeam = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AISubagentTeam> & { id: string }) => {
      const { error } = await supabase
        .from('ai_subagent_teams' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-subagent-teams'] });
      toast.success('Equipo actualizado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  const removeTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_subagent_teams' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-subagent-teams'] });
      queryClient.invalidateQueries({ queryKey: ['ai-subagents'] });
      toast.success('Equipo eliminado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  // ---- Subagents ----
  const query = useQuery({
    queryKey: ['ai-subagents'],
    queryFn: async (): Promise<AISubagent[]> => {
      const { data, error } = await supabase
        .from('ai_subagents' as any)
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (agent: Omit<AISubagent, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('No autenticado');
      const { data, error } = await supabase
        .from('ai_subagents' as any)
        .insert({ ...agent, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-subagents'] });
      toast.success('Subagente creado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AISubagent> & { id: string }) => {
      const { error } = await supabase
        .from('ai_subagents' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-subagents'] });
      toast.success('Subagente actualizado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_subagents' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-subagents'] });
      toast.success('Subagente eliminado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  return {
    // Teams
    teams: teamsQuery.data || [],
    isLoadingTeams: teamsQuery.isLoading,
    createTeam,
    updateTeam,
    removeTeam,
    // Subagents
    subagents: query.data || [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
  };
}
