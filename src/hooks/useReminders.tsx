import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Reminder {
  id: string;
  leadId: string;
  userId: string;
  reminderDate: Date;
  message?: string;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  lead?: {
    companyName: string;
    contactName?: string;
  };
}

function mapRowToReminder(row: any): Reminder {
  return {
    id: row.id,
    leadId: row.lead_id,
    userId: row.user_id,
    reminderDate: new Date(row.reminder_date),
    message: row.message,
    isCompleted: row.is_completed,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lead: row.leads ? {
      companyName: row.leads.company_name,
      contactName: row.leads.contact_name,
    } : undefined,
  };
}

export function useReminders(leadId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading, error } = useQuery({
    queryKey: ['reminders', leadId],
    queryFn: async () => {
      let query = supabase
        .from('follow_up_reminders')
        .select('*, leads(company_name, contact_name)')
        .order('reminder_date', { ascending: true });
      
      if (leadId) {
        query = query.eq('lead_id', leadId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data.map(mapRowToReminder);
    },
    enabled: !!user,
  });

  const addReminder = useMutation({
    mutationFn: async ({ leadId, reminderDate, message }: { leadId: string; reminderDate: Date; message?: string }) => {
      const { data, error } = await supabase
        .from('follow_up_reminders')
        .insert({
          lead_id: leadId,
          user_id: user?.id,
          reminder_date: reminderDate.toISOString(),
          message,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the reminder activity
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: 'nota',
        description: `Recordatorio programado para ${reminderDate.toLocaleDateString('es-ES')}${message ? `: ${message}` : ''}`,
        user_id: user?.id,
      });
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', variables.leadId] });
      toast({
        title: 'Recordatorio creado',
        description: 'El recordatorio de seguimiento ha sido programado.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo crear el recordatorio.',
        variant: 'destructive',
      });
    },
  });

  const completeReminder = useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase
        .from('follow_up_reminders')
        .update({ is_completed: true })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders', variables.leadId] });
      toast({
        title: 'Recordatorio completado',
        description: 'El recordatorio ha sido marcado como completado.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo completar el recordatorio.',
        variant: 'destructive',
      });
    },
  });

  const deleteReminder = useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase
        .from('follow_up_reminders')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders', variables.leadId] });
      toast({
        title: 'Recordatorio eliminado',
        description: 'El recordatorio ha sido eliminado.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el recordatorio.',
        variant: 'destructive',
      });
    },
  });

  // Get pending reminders (not completed and due)
  const pendingReminders = reminders.filter(r => !r.isCompleted);
  const overdueReminders = pendingReminders.filter(r => r.reminderDate < new Date());
  const upcomingReminders = pendingReminders.filter(r => r.reminderDate >= new Date());

  return {
    reminders,
    pendingReminders,
    overdueReminders,
    upcomingReminders,
    isLoading,
    error,
    addReminder: addReminder.mutate,
    completeReminder: completeReminder.mutate,
    deleteReminder: deleteReminder.mutate,
    isAddingReminder: addReminder.isPending,
  };
}
