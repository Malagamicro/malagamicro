import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LeadActivity } from '@/types/lead';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

// Map database row to LeadActivity type
function mapRowToActivity(row: any): LeadActivity {
  return {
    id: row.id,
    leadId: row.lead_id,
    type: row.type as LeadActivity['type'],
    description: row.description,
    createdAt: new Date(row.created_at),
    createdBy: row.user_id,
  };
}

export function useLeadActivities(leadId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data.map(mapRowToActivity);
    },
    enabled: !!user && !!leadId,
  });

  const addActivity = useMutation({
    mutationFn: async (activity: { type: LeadActivity['type']; description: string }) => {
      const { error } = await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: activity.type,
        description: activity.description,
        user_id: user?.id,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      toast({
        title: 'Actividad registrada',
        description: 'La actividad ha sido añadida correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo registrar la actividad.',
        variant: 'destructive',
      });
    },
  });

  const deleteActivity = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from('lead_activities')
        .delete()
        .eq('id', activityId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      toast({
        title: 'Actividad eliminada',
        description: 'La actividad ha sido eliminada.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la actividad.',
        variant: 'destructive',
      });
    },
  });

  return {
    activities,
    isLoading,
    error,
    addActivity: addActivity.mutate,
    deleteActivity: deleteActivity.mutate,
    isAddingActivity: addActivity.isPending,
  };
}
