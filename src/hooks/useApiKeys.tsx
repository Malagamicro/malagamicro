import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ApiKey {
  id: string;
  user_id: string;
  api_key: string;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export function useApiKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_api_keys' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); toast.error('Error cargando API keys'); }
    else setKeys((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const createKey = async (name: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('user_api_keys' as any)
      .insert({ user_id: user.id, name } as any);
    if (error) { toast.error('Error creando API key'); return; }
    toast.success('API Key creada');
    fetchKeys();
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from('user_api_keys' as any).delete().eq('id', id);
    if (error) { toast.error('Error eliminando API key'); return; }
    toast.success('API Key eliminada');
    fetchKeys();
  };

  const toggleKey = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from('user_api_keys' as any).update({ is_active: isActive } as any).eq('id', id);
    if (error) { toast.error('Error actualizando API key'); return; }
    fetchKeys();
  };

  return { keys, loading, createKey, deleteKey, toggleKey, refetch: fetchKeys };
}
