import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SupportTicket } from '@/types/support';
import { toast } from 'sonner';

export function useSupportTickets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: async () => {
      // For this implementation, users can see all tickets (or we can filter by user.id if we want them to see only theirs)
      // Since it's a CRM support, seeing all might be useful, but let's just fetch them. RLS will enforce DB-level filtering if needed.
      const { data, error } = await supabase
        .from('crm_support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Handle case where table might not exist yet during testing
        if (error.code === '42P01') {
          console.warn('Table crm_support_tickets does not exist yet.');
          return [];
        }
        throw error;
      }
      return data as SupportTicket[];
    },
    enabled: !!user,
  });

  const createTicket = useMutation({
    mutationFn: async (newTicket: { title: string; description: string; priority: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('crm_support_tickets')
        .insert([{
          ...newTicket,
          user_id: user.id,
          status: 'abierto'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Ticket creado con éxito');
    },
  });

  const updateTicketStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SupportTicket['status'] }) => {
      const { data, error } = await supabase
        .from('crm_support_tickets')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success(`Ticket marcado como ${data.status}`);
    },
  });

  return {
    tickets,
    isLoading,
    createTicket: createTicket.mutate,
    isCreating: createTicket.isPending,
    updateStatus: updateTicketStatus.mutate,
    isUpdating: updateTicketStatus.isPending,
  };
}
