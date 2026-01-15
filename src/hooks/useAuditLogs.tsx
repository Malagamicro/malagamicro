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

export interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  totalCount: number;
  pageCount: number;
}

export function useAuditLogs(
  page: number = 1,
  pageSize: number = 20,
  dateRange?: DateRange,
  actionTypes?: string[]
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['audit-logs', page, pageSize, dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), actionTypes],
    queryFn: async (): Promise<PaginatedAuditLogs> => {
      // Build base query for count
      let countQuery = supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });

      // Build data query
      let dataQuery = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters to both queries
      if (dateRange?.from) {
        const fromIso = dateRange.from.toISOString();
        countQuery = countQuery.gte('created_at', fromIso);
        dataQuery = dataQuery.gte('created_at', fromIso);
      }
      if (dateRange?.to) {
        const endDate = new Date(dateRange.to);
        endDate.setDate(endDate.getDate() + 1);
        const toIso = endDate.toISOString();
        countQuery = countQuery.lt('created_at', toIso);
        dataQuery = dataQuery.lt('created_at', toIso);
      }
      if (actionTypes && actionTypes.length > 0) {
        countQuery = countQuery.in('action', actionTypes);
        dataQuery = dataQuery.in('action', actionTypes);
      }

      // Get total count
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      dataQuery = dataQuery.range(from, to);

      const { data, error } = await dataQuery as { data: AuditLogEntry[] | null; error: any };
      if (error) throw error;

      const totalCount = count || 0;
      const pageCount = Math.ceil(totalCount / pageSize);

      return {
        data: data || [],
        totalCount,
        pageCount,
      };
    },
    enabled: !!user,
  });
}
