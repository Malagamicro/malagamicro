import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ExitRecord {
  id: string;
  user_id: string;
  student_name: string;
  exit_date: string;
  exit_time: string | null;
  return_time: string | null;
  reason: string;
  destination: string | null;
  notes: string | null;
  created_at: string;
}

export function useExitRecords() {
  const { user } = useAuth();
  const [records, setRecords] = useState<ExitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('exit_records')
        .select('*')
        .order('exit_date', { ascending: false });
      if (error) throw error;
      setRecords((data || []) as ExitRecord[]);
    } catch (err) {
      console.error('Error fetching exit records:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const addRecord = async (data: Omit<ExitRecord, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('exit_records').insert({ ...data, user_id: user.id });
      if (error) throw error;
      toast.success('Registro de salida añadido');
      fetchRecords();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const { error } = await supabase.from('exit_records').delete().eq('id', id);
      if (error) throw error;
      toast.success('Registro eliminado');
      fetchRecords();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  return { records, isLoading, addRecord, deleteRecord, refetch: fetchRecords };
}
