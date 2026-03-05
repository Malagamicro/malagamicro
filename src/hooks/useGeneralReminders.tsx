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
  is_completed: boolean; // computed per-user
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string | null;
  recurrence_type: string;
  snooze_until: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  is_owner: boolean; // whether current user created it
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

  // Single query that fetches both reminders and user's completions
  const { data, isLoading } = useQuery({
    queryKey: ['general-reminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return { reminders: [], completedIds: [] };
      
      const [remindersRes, completionsRes] = await Promise.all([
        supabase
          .from('general_reminders')
          .select('*')
          .order('reminder_date', { ascending: true }),
        supabase
          .from('general_reminder_completions' as any)
          .select('reminder_id')
          .eq('user_id', user.id),
      ]);

      if (remindersRes.error) throw remindersRes.error;
      const completedIds = (completionsRes.data || []).map((c: any) => c.reminder_id as string);
      return { reminders: (remindersRes.data || []) as any[], completedIds };
    },
    enabled: !!user?.id,
  });

  const reminders = data?.reminders || [];
  const completedSet = new Set(data?.completedIds || []);

  // Enrich reminders with per-user completion status
  const enrichedReminders: GeneralReminder[] = reminders.map((r: any) => ({
    ...r,
    is_completed: completedSet.has(r.id),
    is_owner: r.user_id === user?.id,
  }));

  const now = new Date();
  const pendingReminders = enrichedReminders.filter(r => {
    if (r.is_completed) return false;
    if (r.snooze_until && new Date(r.snooze_until) > now) return false;
    return true;
  });
  const snoozedReminders = enrichedReminders.filter(r => !r.is_completed && r.snooze_until && new Date(r.snooze_until) > now);
  const completedReminders = enrichedReminders.filter(r => r.is_completed);
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
      if (data.recurrence_type !== undefined) updateData.recurrence_type = data.recurrence_type;
      if (data.snooze_until !== undefined) updateData.snooze_until = data.snooze_until;
      if (data.linked_entity_type !== undefined) updateData.linked_entity_type = data.linked_entity_type;
      if (data.linked_entity_id !== undefined) updateData.linked_entity_id = data.linked_entity_id;
      if (data.note !== undefined) updateData.note = data.note;

      // Don't update is_completed on the main table anymore
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

  // Per-user toggle: insert/delete from general_reminder_completions
  const toggleCompleteMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      if (!user?.id) throw new Error('No autenticado');

      if (isCompleted) {
        // Uncomplete: delete the completion record
        const { error } = await supabase
          .from('general_reminder_completions' as any)
          .delete()
          .eq('reminder_id', id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        // Complete: insert a completion record
        const { error } = await supabase
          .from('general_reminder_completions' as any)
          .insert({ reminder_id: id, user_id: user.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-reminder-completions'] });
      queryClient.invalidateQueries({ queryKey: ['general-reminders'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleComplete = (id: string, isCompleted: boolean) => {
    toggleCompleteMutation.mutate({ id, isCompleted });
  };

  return {
    reminders: enrichedReminders,
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
