import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface GeneralReminder {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  reminder_date: string;
  is_completed: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string | null;
  recurrence_type: string;
  snooze_until: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateReminderData {
  title: string;
  description?: string;
  reminderDate: Date;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;
  recurrence_type?: string;
  linked_entity_type?: string;
  linked_entity_id?: string;
  note?: string;
  target_user_ids?: string[];
}

interface UpdateReminderData {
  id: string;
  title?: string;
  description?: string;
  reminderDate?: Date;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;
  is_completed?: boolean;
  recurrence_type?: string;
  snooze_until?: string | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  note?: string | null;
}

export function useGeneralReminders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['general-reminders'],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('general_reminders')
        .select('*')
        .order('reminder_date', { ascending: true });

      if (error) throw error;
      return data as unknown as GeneralReminder[];
    },
    enabled: !!user?.id,
  });

  const now = new Date();
  const pendingReminders = reminders.filter(r => {
    if (r.is_completed) return false;
    // If snoozed, hide until snooze expires
    if (r.snooze_until && new Date(r.snooze_until) > now) return false;
    return true;
  });
  const snoozedReminders = reminders.filter(r => !r.is_completed && r.snooze_until && new Date(r.snooze_until) > now);
  const completedReminders = reminders.filter(r => r.is_completed);
  const upcomingReminders = pendingReminders.filter(r => new Date(r.reminder_date) >= now);
  const overdueReminders = pendingReminders.filter(r => new Date(r.reminder_date) < now);

  const addReminderMutation = useMutation({
    mutationFn: async (data: CreateReminderData) => {
      if (!user?.id) throw new Error('No autenticado');

      const { error } = await supabase.from('general_reminders').insert({
        user_id: user.id,
        title: data.title,
        description: data.description || null,
        reminder_date: data.reminderDate.toISOString(),
        priority: data.priority || 'normal',
        category: data.category || 'general',
        recurrence_type: data.recurrence_type || 'once',
        linked_entity_type: data.linked_entity_type || null,
        linked_entity_id: data.linked_entity_id || null,
        note: data.note || null,
        target_user_ids: data.target_user_ids || [],
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-reminders'] });
      toast({ title: 'Recordatorio creado', description: 'El recordatorio se ha programado correctamente.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: async (data: UpdateReminderData) => {
      const updateData: Record<string, unknown> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.reminderDate !== undefined) updateData.reminder_date = data.reminderDate.toISOString();
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.is_completed !== undefined) updateData.is_completed = data.is_completed;
      if (data.recurrence_type !== undefined) updateData.recurrence_type = data.recurrence_type;
      if (data.snooze_until !== undefined) updateData.snooze_until = data.snooze_until;
      if (data.linked_entity_type !== undefined) updateData.linked_entity_type = data.linked_entity_type;
      if (data.linked_entity_id !== undefined) updateData.linked_entity_id = data.linked_entity_id;
      if (data.note !== undefined) updateData.note = data.note;

      const { error } = await supabase
        .from('general_reminders')
        .update(updateData as any)
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-reminders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const snoozeReminder = (id: string, minutes: number) => {
    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    updateReminderMutation.mutate({ id, snooze_until: snoozeUntil });
    const label = minutes < 60 ? `${minutes} min` : minutes === 60 ? '1 hora' : 'mañana';
    toast({ title: 'Pospuesto', description: `Recordatorio pospuesto ${label}.` });
  };

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('general_reminders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-reminders'] });
      toast({ title: 'Recordatorio eliminado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleComplete = (id: string, isCompleted: boolean) => {
    updateReminderMutation.mutate({ id, is_completed: !isCompleted });
  };

  return {
    reminders,
    pendingReminders,
    completedReminders,
    upcomingReminders,
    overdueReminders,
    snoozedReminders,
    isLoading,
    addReminder: addReminderMutation.mutate,
    isAddingReminder: addReminderMutation.isPending,
    updateReminder: updateReminderMutation.mutate,
    isUpdatingReminder: updateReminderMutation.isPending,
    deleteReminder: deleteReminderMutation.mutate,
    isDeletingReminder: deleteReminderMutation.isPending,
    snoozeReminder,
    toggleComplete,
  };
}
