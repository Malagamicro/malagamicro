import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export function useAuditLogs(limit: number = 50, dateRange?: DateRange, actionTypes?: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['audit-logs', limit, dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), actionTypes],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        // Add 1 day to include the entire end date
        const endDate = new Date(dateRange.to);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('created_at', endDate.toISOString());
      }
      if (actionTypes && actionTypes.length > 0) {
        query = query.in('action', actionTypes);
      }

      const { data, error } = await query.limit(limit) as { data: AuditLogEntry[] | null; error: any };
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}
