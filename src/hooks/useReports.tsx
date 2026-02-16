import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Report {
  id: string;
  title: string;
  content: string;
  report_type: string;
  status: string;
  generated_by: string;
  recipient_id: string | null;
  week_start: string | null;
  week_end: string | null;
  source_data: any;
  created_at: string;
}

export function useReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports((data || []) as Report[]);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const generateReport = async (weekStart: string, weekEnd: string) => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-exit-report', {
        body: { week_start: weekStart, week_end: weekEnd },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Informe generado correctamente');
      fetchReports();
    } catch (err: any) {
      toast.error('Error al generar informe: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteReport = async (id: string) => {
    try {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;
      toast.success('Informe eliminado');
      fetchReports();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  return { reports, isLoading, isGenerating, generateReport, deleteReport, refetch: fetchReports };
}
