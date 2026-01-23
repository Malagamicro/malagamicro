import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { analyzeSpanishPhone, enrichLeadPhone, EnrichmentResult } from '@/lib/phoneEnrichment';
import { useToast } from './use-toast';

export interface EnrichmentProgress {
  total: number;
  completed: number;
  current?: string;
}

export function usePhoneEnrichment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);

  /**
   * Enrich a single lead's phone data
   */
  const enrichSingleLead = useMutation({
    mutationFn: async ({ 
      leadId, 
      phone, 
      website 
    }: { 
      leadId: string; 
      phone: string; 
      website?: string;
    }) => {
      const result = await enrichLeadPhone(phone, website, leadId);
      return { leadId, result };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      console.error('Enrichment error:', error);
    },
  });

  /**
   * Enrich multiple leads in batch
   */
  const enrichBatchLeads = useCallback(async (
    leads: Array<{ id: string; phone?: string; website?: string; companyName: string }>
  ) => {
    const leadsWithPhones = leads.filter(l => l.phone);
    
    if (leadsWithPhones.length === 0) {
      return;
    }

    setIsEnriching(true);
    setProgress({ total: leadsWithPhones.length, completed: 0 });

    const BATCH_SIZE = 3; // Process 3 at a time to avoid overwhelming the API
    
    try {
      for (let i = 0; i < leadsWithPhones.length; i += BATCH_SIZE) {
        const batch = leadsWithPhones.slice(i, i + BATCH_SIZE);
        
        await Promise.all(
          batch.map(async (lead) => {
            setProgress(prev => prev ? { ...prev, current: lead.companyName } : null);
            
            try {
              await enrichLeadPhone(lead.phone!, lead.website, lead.id);
            } catch (error) {
              console.error(`Failed to enrich ${lead.companyName}:`, error);
            }
            
            setProgress(prev => prev ? { 
              ...prev, 
              completed: prev.completed + 1,
              current: undefined
            } : null);
          })
        );
      }

      queryClient.invalidateQueries({ queryKey: ['leads'] });
      
      toast({
        title: 'Enriquecimiento completado',
        description: `Se analizaron ${leadsWithPhones.length} teléfonos.`,
      });
    } catch (error) {
      toast({
        title: 'Error en el enriquecimiento',
        description: 'Algunos teléfonos no pudieron ser verificados.',
        variant: 'destructive',
      });
    } finally {
      setIsEnriching(false);
      setProgress(null);
    }
  }, [queryClient, toast]);

  /**
   * Quick phone type analysis (no API call, just regex)
   */
  const analyzePhoneType = useCallback((phone: string) => {
    return analyzeSpanishPhone(phone);
  }, []);

  /**
   * Enrich all leads that haven't been enriched yet
   */
  const enrichUnprocessedLeads = useMutation({
    mutationFn: async () => {
      // Get leads that haven't been enriched (phone_type is 'unknown' or null)
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, phone, website, company_name')
        .not('phone', 'is', null)
        .or('phone_type.is.null,phone_type.eq.unknown')
        .limit(50);

      if (error) throw error;

      if (!leads || leads.length === 0) {
        return 0;
      }

      const mappedLeads = leads.map(l => ({
        id: l.id,
        phone: l.phone!,
        website: l.website || undefined,
        companyName: l.company_name,
      }));

      await enrichBatchLeads(mappedLeads);
      return mappedLeads.length;
    },
    onSuccess: (count) => {
      if (count === 0) {
        toast({
          title: 'Sin leads pendientes',
          description: 'Todos los leads ya han sido analizados.',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudieron enriquecer los leads.',
        variant: 'destructive',
      });
    },
  });

  return {
    enrichSingleLead: enrichSingleLead.mutate,
    enrichBatchLeads,
    enrichUnprocessedLeads: enrichUnprocessedLeads.mutate,
    analyzePhoneType,
    isEnriching: isEnriching || enrichSingleLead.isPending || enrichUnprocessedLeads.isPending,
    progress,
  };
}
