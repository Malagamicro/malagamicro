import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus, DashboardStats } from '@/types/lead';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

// Map database row to Lead type
function mapRowToLead(row: any): Lead {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    website: row.website,
    address: row.address,
    city: row.city,
    status: row.status as LeadStatus,
    segment: row.segment as Lead['segment'],
    source: row.source as Lead['source'],
    equipmentCount: row.equipment_count,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastContactedAt: row.last_contacted_at ? new Date(row.last_contacted_at) : undefined,
    tags: row.tags,
  };
}

export function useLeads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data.map(mapRowToLead);
    },
    enabled: !!user,
  });

  const updateLeadStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase
        .from('leads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Estado actualizado',
        description: 'El estado del lead ha sido actualizado correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del lead.',
        variant: 'destructive',
      });
    },
  });

  const addLead = useMutation({
    mutationFn: async (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { error } = await supabase.from('leads').insert({
        company_name: lead.companyName,
        contact_name: lead.contactName,
        email: lead.email,
        phone: lead.phone,
        website: lead.website,
        address: lead.address,
        city: lead.city,
        status: lead.status,
        segment: lead.segment,
        source: lead.source,
        equipment_count: lead.equipmentCount,
        notes: lead.notes,
        tags: lead.tags,
        user_id: user?.id,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead añadido',
        description: 'El lead ha sido añadido correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudo añadir el lead.',
        variant: 'destructive',
      });
    },
  });

  return {
    leads,
    isLoading,
    error,
    updateLeadStatus: updateLeadStatus.mutate,
    addLead: addLead.mutate,
  };
}

export function useDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase
        .from('leads')
        .select('status, created_at');
      
      if (error) throw error;

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const stats = {
        totalLeads: data.length,
        newLeads: data.filter(l => l.status === 'nuevo').length,
        contactedLeads: data.filter(l => l.status === 'contactado').length,
        interestedLeads: data.filter(l => l.status === 'interesado').length,
        clients: data.filter(l => l.status === 'cliente').length,
        thisWeekLeads: data.filter(l => new Date(l.created_at) >= oneWeekAgo).length,
        conversionRate: data.length > 0 
          ? Number(((data.filter(l => l.status === 'cliente').length / data.length) * 100).toFixed(1))
          : 0,
      };

      return stats;
    },
    enabled: !!user,
  });
}
