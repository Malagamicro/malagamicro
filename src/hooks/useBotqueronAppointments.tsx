import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BotqueronAppointment {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  service: string;
  notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useBotqueronAppointments() {
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['botqueron-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('botqueron_appointments')
        .select('*')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });
      if (error) throw error;
      return data as BotqueronAppointment[];
    },
  });

  const addAppointment = useMutation({
    mutationFn: async (appt: Omit<BotqueronAppointment, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('botqueron_appointments').insert(appt);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botqueron-appointments'] });
      toast.success('Cita creada');
    },
    onError: () => toast.error('Error al crear cita'),
  });

  const updateAppointment = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BotqueronAppointment> & { id: string }) => {
      const { error } = await supabase
        .from('botqueron_appointments')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botqueron-appointments'] });
      toast.success('Cita actualizada');
    },
    onError: () => toast.error('Error al actualizar cita'),
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('botqueron_appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botqueron-appointments'] });
      toast.success('Cita eliminada');
    },
    onError: () => toast.error('Error al eliminar cita'),
  });

  return { appointments, isLoading, addAppointment, updateAppointment, deleteAppointment };
}
