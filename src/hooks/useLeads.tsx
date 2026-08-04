import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus, DashboardStats } from '@/types/lead';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useAuditLog } from './useAuditLog';
import { geocodeAddress } from './useGeocoding';

const PAGE_SIZE = 20;

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
    equipmentCount: row.equipment_count ?? undefined,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastContactedAt: row.last_contacted_at ? new Date(row.last_contacted_at) : undefined,
    tags: row.tags,
    score: row.score ?? 0,
    emailUnsubscribed: row.email_unsubscribed ?? false,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    folderId: row.folder_id ?? undefined,
    // Phone enrichment fields
    phoneType: row.phone_type as Lead['phoneType'] ?? undefined,
    mobilePhone: row.mobile_phone ?? undefined,
    whatsappVerified: row.whatsapp_verified ?? undefined,
    // WhatsApp counter
    whatsappSentCount: row.whatsapp_sent_count ?? 0,
    googlePlaceId: (row as any).google_place_id ?? undefined,
  };
}

interface LeadsPage {
  leads: Lead[];
  nextCursor: number | null;
  totalCount: number;
}

export function useLeads(options?: { search?: string; status?: string; segment?: string; folderId?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logLeadCreated, logLeadUpdated, logLeadDeleted, logLeadStatusChanged, logLeadsImported } = useAuditLog();

  const searchKey = options?.search?.trim() || '';
  const statusKey = options?.status || 'all';
  const segmentKey = options?.segment || 'all';
  const folderKey = options?.folderId || 'all';

  // Paginated query with useInfiniteQuery
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['leads', searchKey, statusKey, segmentKey, folderKey],
    queryFn: async ({ pageParam = 0 }): Promise<LeadsPage> => {
      const from = pageParam;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' });

      if (searchKey) {
        query = query.or(`company_name.ilike.%${searchKey}%,contact_name.ilike.%${searchKey}%,city.ilike.%${searchKey}%,email.ilike.%${searchKey}%`);
      }
      if (statusKey !== 'all') {
        query = query.eq('status', statusKey);
      }
      if (segmentKey !== 'all') {
        query = query.eq('segment', segmentKey);
      }
      if (folderKey !== 'all') {
        if (folderKey === 'none') {
          query = query.is('folder_id', null);
        } else {
          query = query.eq('folder_id', folderKey);
        }
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      
      const leads = data.map(mapRowToLead);
      const totalCount = count ?? 0;
      const nextCursor = to < totalCount - 1 ? to + 1 : null;

      return {
        leads,
        nextCursor,
        totalCount,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!user,
  });

  // Flatten all pages into a single leads array
  const leads = data?.pages.flatMap(page => page.leads) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

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
    // Optimistic update - update local cache immediately
    onMutate: async ({ id, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['leads'] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(['leads']);

      // Optimistically update the cache
      queryClient.setQueryData(['leads'], (oldData: any) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: LeadsPage) => ({
            ...page,
            leads: page.leads.map((lead: Lead) =>
              lead.id === id ? { ...lead, status } : lead
            ),
          })),
        };
      });

      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['leads'], context.previousData);
      }
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado del lead.',
        variant: 'destructive',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', variables.id] });
      // Audit log
      if (variables.previousStatus) {
        logLeadStatusChanged(variables.id, variables.previousStatus, variables.status);
      }
      toast({
        title: 'Estado actualizado',
        description: 'El estado del lead ha sido actualizado correctamente.',
      });
    },
    onSettled: () => {
      // Refetch after mutation settles to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const addLead = useMutation({
    mutationFn: async (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      // Import the phone analysis function
      const { analyzeSpanishPhone } = await import('@/lib/phoneEnrichment');

      // Geocode the address
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      if (lead.address || lead.city) {
        const coords = await geocodeAddress(lead.address, lead.city);
        if (coords) {
          latitude = coords.latitude;
          longitude = coords.longitude;
        }
      }

      // Analyze phone type
      const phoneType = lead.phone ? analyzeSpanishPhone(lead.phone) : 'unknown';

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
        user_id: user.id,
        latitude,
        longitude,
        folder_id: lead.folderId || null,
        phone_type: phoneType,
        mobile_phone: phoneType === 'mobile' ? lead.phone?.replace(/\D/g, '').replace(/^34/, '') : null,
        google_place_id: (lead as any).googlePlaceId || null,
      }).select('id, phone, website').single();
      
      if (error) throw error;

      // Log the lead creation activity
      if (data) {
        await supabase.from('lead_activities').insert({
          lead_id: data.id,
          type: 'creado',
          description: `Lead "${lead.companyName}" creado`,
          user_id: user?.id,
        });
        
        // Trigger enrichment for landline leads with websites
        if (phoneType === 'landline' && lead.website) {
          // Fire and forget
          supabase.functions.invoke('enrich-lead-phone', {
            body: { 
              phone: lead.phone, 
              website: lead.website, 
              leadId: data.id 
            },
          }).catch(e => console.error('Enrichment failed:', e));
        }
      }

      return { ...data, phoneType };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      // Audit log
      if (data?.id) {
        logLeadCreated(data.id, variables.companyName);
      }
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
      // Geocode the address if address or city changed
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      if (lead.address !== undefined || lead.city !== undefined) {
        const coords = await geocodeAddress(lead.address, lead.city);
        if (coords) {
          latitude = coords.latitude;
          longitude = coords.longitude;
        }
      }

      const updateData: Record<string, unknown> = {
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
      };

      // CRITICAL: Always update folder_id if the key exists in the object (even if null)
      if ('folderId' in lead) {
        updateData.folder_id = lead.folderId;
      }

      // Only update coordinates if we got new ones
      if (latitude !== undefined && longitude !== undefined) {
        updateData.latitude = latitude;
        updateData.longitude = longitude;
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      // We must return the updated lead data to allow optimistic updates to be merged correctly
      // but since we don't return from the mutationFn normally, the cache update in onMutate handles it.
    },
    onMutate: async (updatedLead) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['leads'] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(['leads']);

      // Optimistically update the cache
      queryClient.setQueryData(['leads'], (oldData: any) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: LeadsPage) => ({
            ...page,
            leads: page.leads.map((lead: Lead) =>
              lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead
            ),
          })),
        };
      });

      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['leads'], context.previousData);
      }
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el lead.',
        variant: 'destructive',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      // Audit log
      logLeadUpdated(variables.id, variables);
      toast({
        title: 'Lead actualizado',
        description: 'El lead ha sido actualizado correctamente.',
      });
    },
    onSettled: () => {
      // Refetch after mutation settles to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async ({ id, companyName }: { id: string; companyName: string }) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, companyName };
    },
    onSuccess: ({ id, companyName }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      // Audit log
      logLeadDeleted(id, companyName);
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
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      // Import the phone analysis function
      const { analyzeSpanishPhone } = await import('@/lib/phoneEnrichment');

      const leadsToInsert = leads.map(lead => {
        // Analyze phone type immediately
        const phoneType = lead.phone ? analyzeSpanishPhone(lead.phone) : 'unknown';
        
        return {
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
          user_id: user.id,
          folder_id: lead.folderId || null,
          // Add phone type from analysis
          phone_type: phoneType,
          // If it's already a mobile, mark it (verification will happen async)
          mobile_phone: phoneType === 'mobile' ? lead.phone?.replace(/\D/g, '').replace(/^34/, '') : null,
        };
      });
      
      // Insert leads and get their IDs back
      const { data, error } = await supabase
        .from('leads')
        .insert(leadsToInsert)
        .select('id, phone, website, company_name, phone_type');
      
      if (error) throw error;
      
      // Return inserted leads for enrichment
      return { 
        count: leadsToInsert.length, 
        insertedLeads: data || [] 
      };
    },
    onSuccess: ({ count, insertedLeads }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      // Audit log
      logLeadsImported(count);
      toast({
        title: 'Importación completada',
        description: `Se han importado ${count} leads correctamente.`,
      });
      
      // Trigger async enrichment for landline leads with websites
      const landlineLeadsWithWebsite = insertedLeads.filter(
        l => l.phone_type === 'landline' && l.website
      );
      
      if (landlineLeadsWithWebsite.length > 0) {
        toast({
          title: 'Enriquecimiento en progreso',
          description: `Buscando móviles en ${landlineLeadsWithWebsite.length} webs...`,
        });
        
        // Fire and forget - enrichment happens in background
        Promise.all(
          landlineLeadsWithWebsite.map(async (lead) => {
            try {
              await supabase.functions.invoke('enrich-lead-phone', {
                body: { 
                  phone: lead.phone, 
                  website: lead.website, 
                  leadId: lead.id 
                },
              });
            } catch (e) {
              console.error(`Failed to enrich lead ${lead.company_name}:`, e);
            }
          })
        ).then(() => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error en la importación',
        description: 'No se pudieron importar los leads. Verifica el formato de los datos.',
        variant: 'destructive',
      });
    },
  });

  const geocodeLead = useMutation({
    mutationFn: async ({ id, address, city }: { id: string; address?: string; city?: string }) => {
      const coords = await geocodeAddress(address, city);
      
      if (!coords) {
        throw new Error('No se pudo obtener las coordenadas para esta dirección');
      }

      const { error } = await supabase
        .from('leads')
        .update({
          latitude: coords.latitude,
          longitude: coords.longitude,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
      return coords;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Ubicación actualizada',
        description: 'Las coordenadas del lead han sido actualizadas correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error de geocodificación',
        description: error instanceof Error ? error.message : 'No se pudieron obtener las coordenadas.',
        variant: 'destructive',
      });
    },
  });

  const bulkGeocode = useMutation({
    mutationFn: async (leadsToGeocode: { id: string; address?: string; city?: string }[]) => {
      let successCount = 0;
      let failCount = 0;

      for (const lead of leadsToGeocode) {
        try {
          const coords = await geocodeAddress(lead.address, lead.city);
          
          if (coords) {
            const { error } = await supabase
              .from('leads')
              .update({
                latitude: coords.latitude,
                longitude: coords.longitude,
                updated_at: new Date().toISOString(),
              })
              .eq('id', lead.id);
            
            if (!error) {
              successCount++;
            } else {
              failCount++;
            }
          } else {
            failCount++;
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          failCount++;
        }
      }

      return { successCount, failCount, total: leadsToGeocode.length };
    },
    onSuccess: ({ successCount, failCount, total }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Geocodificación completada',
        description: `${successCount} de ${total} leads actualizados${failCount > 0 ? `. ${failCount} fallidos.` : '.'}`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Ocurrió un error durante la geocodificación masiva.',
        variant: 'destructive',
      });
    },
  });

  // BULK DELETE leads
  const bulkDeleteLeads = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user?.id) {
        throw new Error('Usuario no autenticado');
      }

      // Delete in batches of 50 to avoid potential issues
      const chunkSize = 50;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('leads')
          .delete()
          .in('id', chunk);
        
        if (error) throw error;
      }
      
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: 'Leads eliminados',
        description: `Se han eliminado ${count} leads correctamente.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudieron eliminar los leads.',
        variant: 'destructive',
      });
    },
  });

  return {
    leads,
    totalCount,
    isLoading,
    error,
    // Pagination
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    // Mutations
    updateLeadStatus: updateLeadStatus.mutate,
    addLead: addLead.mutate,
    updateLead: updateLead.mutate,
    deleteLead: deleteLead.mutate,
    importLeads: importLeads.mutate,
    geocodeLead: geocodeLead.mutate,
    bulkGeocode: bulkGeocode.mutate,
    bulkDeleteLeads: bulkDeleteLeads.mutate,
    // Loading states
    isAddingLead: addLead.isPending,
    isUpdatingLead: updateLead.isPending,
    isDeletingLead: deleteLead.isPending,
    isImportingLeads: importLeads.isPending,
    isGeocodingLead: geocodeLead.isPending,
    isBulkGeocoding: bulkGeocode.isPending,
    isBulkDeleting: bulkDeleteLeads.isPending,
  };
}

export function useDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weekIso = oneWeekAgo.toISOString();

      // Run fast count queries in parallel instead of downloading all rows
      const [
        { count: totalCount },
        { count: newCount },
        { count: contactedCount },
        { count: interestedCount },
        { count: clientCount },
        { count: thisWeekCount }
      ] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'nuevo'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'contactado'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'interesado'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'cliente'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', weekIso)
      ]);

      const t = totalCount || 0;
      const c = clientCount || 0;

      return {
        totalLeads: t,
        newLeads: newCount || 0,
        contactedLeads: contactedCount || 0,
        interestedLeads: interestedCount || 0,
        clients: c,
        thisWeekLeads: thisWeekCount || 0,
        conversionRate: t > 0 ? Number(((c / t) * 100).toFixed(1)) : 0,
      };
    },
    enabled: !!user,
  });
}
