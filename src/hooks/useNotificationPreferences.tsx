import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface NotificationPreferences {
  id: string;
  user_id: string;
  email_lead_updates: boolean;
  email_reminder_notifications: boolean;
  email_campaign_reports: boolean;
  email_weekly_summary: boolean;
  email_security_alerts: boolean;
  created_at: string;
  updated_at: string;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      // If no preferences exist, create default ones
      if (!data) {
        const { data: newPrefs, error: createError } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
          })
          .select()
          .single();
        
        if (createError) throw createError;
        return newPrefs as NotificationPreferences;
      }
      
      return data as NotificationPreferences;
    },
    enabled: !!user?.id,
  });

  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!user?.id) throw new Error('No user');
      
      const { data, error } = await supabase
        .from('notification_preferences')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', user?.id] });
      toast({
        title: 'Preferencias actualizadas',
        description: 'Tus preferencias de notificación se han guardado.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudieron guardar las preferencias.',
        variant: 'destructive',
      });
    },
  });

  return {
    preferences,
    isLoading,
    updatePreferences: updatePreferences.mutate,
    isUpdating: updatePreferences.isPending,
  };
}
