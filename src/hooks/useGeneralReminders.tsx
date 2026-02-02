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
  created_at: string;
  updated_at: string;
}

interface CreateReminderData {
  title: string;
  description?: string;
  reminderDate: Date;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;
}

interface UpdateReminderData {
  id: string;
  title?: string;
  description?: string;
  reminderDate?: Date;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;
  is_completed?: boolean;
}

export function useGeneralReminders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['general-reminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('general_reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('reminder_date', { ascending: true });

      if (error) throw error;
      return data as GeneralReminder[];
    },
    enabled: !!user?.id,
  });

  const pendingReminders = reminders.filter(r => !r.is_completed);
  const completedReminders = reminders.filter(r => r.is_completed);
  const upcomingReminders = pendingReminders.filter(r => new Date(r.reminder_date) >= new Date());
  const overdueReminders = pendingReminders.filter(r => new Date(r.reminder_date) < new Date());

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
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-reminders'] });
      toast({
        title: 'Recordatorio creado',
        description: 'El recordatorio se ha programado correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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

      const { error } = await supabase
        .from('general_reminders')
        .update(updateData)
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-reminders'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('general_reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-reminders'] });
      toast({
        title: 'Recordatorio eliminado',
        description: 'El recordatorio se ha eliminado correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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
    isLoading,
    addReminder: addReminderMutation.mutate,
    isAddingReminder: addReminderMutation.isPending,
    updateReminder: updateReminderMutation.mutate,
    isUpdatingReminder: updateReminderMutation.isPending,
    deleteReminder: deleteReminderMutation.mutate,
    isDeletingReminder: deleteReminderMutation.isPending,
    toggleComplete,
  };
}
