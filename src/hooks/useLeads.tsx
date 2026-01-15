import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus, DashboardStats } from '@/types/lead';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

const statusLabels: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  interesado: 'Interesado',
  cliente: 'Cliente',
};

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
    score: row.score ?? 0,
    emailUnsubscribed: row.email_unsubscribed ?? false,
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
    mutationFn: async ({ id, status, previousStatus }: { id: string; status: LeadStatus; previousStatus?: LeadStatus }) => {
      const { error } = await supabase
        .from('leads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;

      // Log the status change activity
      if (previousStatus && previousStatus !== status) {
        await supabase.from('lead_activities').insert({
          lead_id: id,
          type: 'estado',
          description: `Estado cambiado de "${statusLabels[previousStatus]}" a "${statusLabels[status]}"`,
          user_id: user?.id,
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', variables.id] });
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
      const { data, error } = await supabase.from('leads').insert({
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
      }).select('id').single();
      
      if (error) throw error;

      // Log the lead creation activity
      if (data) {
        await supabase.from('lead_activities').insert({
          lead_id: data.id,
          type: 'creado',
          description: `Lead "${lead.companyName}" creado`,
          user_id: user?.id,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
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

  const updateLead = useMutation({
    mutationFn: async ({ id, ...lead }: Partial<Lead> & { id: string }) => {
      const { error } = await supabase
        .from('leads')
        .update({
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: 'Lead actualizado',
        description: 'El lead ha sido actualizado correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el lead.',
        variant: 'destructive',
      });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: 'Lead eliminado',
        description: 'El lead ha sido eliminado correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el lead.',
        variant: 'destructive',
      });
    },
  });

  const importLeads = useMutation({
    mutationFn: async (leads: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>[]) => {
      const leadsToInsert = leads.map(lead => ({
        company_name: lead.companyName,
        contact_name: lead.contactName || null,
        email: lead.email || null,
        phone: lead.phone || null,
        website: lead.website || null,
        address: lead.address || null,
        city: lead.city,
        status: lead.status || 'nuevo',
        segment: lead.segment || 'pyme',
        source: lead.source || 'manual',
        equipment_count: lead.equipmentCount || null,
        notes: lead.notes || null,
        tags: lead.tags || null,
        user_id: user?.id,
      }));
      
      const { error } = await supabase.from('leads').insert(leadsToInsert);
      
      if (error) throw error;
      return leadsToInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: 'Importación completada',
        description: `Se han importado ${count} leads correctamente.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error en la importación',
        description: 'No se pudieron importar los leads. Verifica el formato de los datos.',
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
    updateLead: updateLead.mutate,
    deleteLead: deleteLead.mutate,
    importLeads: importLeads.mutate,
    isAddingLead: addLead.isPending,
    isUpdatingLead: updateLead.isPending,
    isDeletingLead: deleteLead.isPending,
    isImportingLeads: importLeads.isPending,
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
