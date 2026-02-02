import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface OsTicketRecord {
  id: string;
  user_id: string;
  ticket_id: string | null;
  ticket_number: string | null;
  subject: string;
  customer_name: string | null;
  customer_email: string | null;
  department: string | null;
  priority: string | null;
  message: string | null;
  notification_sent: boolean;
  notification_phone: string | null;
  created_at: string;
}

export function useOsTicketHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading, refetch } = useQuery({
    queryKey: ['osticket-tickets', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await (supabase as any)
        .from('osticket_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OsTicketRecord[];
    },
    enabled: !!user?.id,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('osticket-tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'osticket_tickets',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['osticket-tickets'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const { mutate: deleteTicket, isPending: isDeleting } = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await (supabase as any)
        .from('osticket_tickets')
        .delete()
        .eq('id', ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['osticket-tickets'] });
      toast.success('Ticket eliminado del historial');
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });

  const { mutate: clearHistory, isPending: isClearing } = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');

      const { error } = await (supabase as any)
        .from('osticket_tickets')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['osticket-tickets'] });
      toast.success('Historial limpiado');
    },
    onError: (error: Error) => {
      toast.error(`Error al limpiar historial: ${error.message}`);
    },
  });

  // Statistics
  const stats = {
    total: tickets?.length || 0,
    sentOk: tickets?.filter(t => t.notification_sent).length || 0,
    failed: tickets?.filter(t => !t.notification_sent).length || 0,
    today: tickets?.filter(t => {
      const ticketDate = new Date(t.created_at).toDateString();
      const today = new Date().toDateString();
      return ticketDate === today;
    }).length || 0,
  };

  return {
    tickets: tickets || [],
    isLoading,
    refetch,
    deleteTicket,
    isDeleting,
    clearHistory,
    isClearing,
    stats,
  };
}
