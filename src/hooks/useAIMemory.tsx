import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AIMemory {
  id: string;
  user_id: string;
  lead_id: string | null;
  memory_key: string;
  memory_value: Record<string, unknown>;
  category: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export function useAIMemory() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMemories = useCallback(async (leadId?: string, category?: string) => {
    if (!user) return [];
    setLoading(true);
    try {
      let query = supabase
        .from('ai_memory' as any)
        .select('*')
        .order('updated_at', { ascending: false });

      if (leadId) query = query.eq('lead_id', leadId);
      if (category) query = query.eq('category', category);

      const { data, error } = await query.limit(50);
      if (error) throw error;
      const result = (data || []) as unknown as AIMemory[];
      setMemories(result);
      return result;
    } catch (err) {
      console.error('Error fetching AI memories:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveMemory = useCallback(async (
    memoryKey: string,
    memoryValue: Record<string, unknown>,
    category = 'general',
    leadId?: string,
    isShared = false
  ) => {
    if (!user) return null;
    try {
      const record: any = {
        user_id: user.id,
        memory_key: memoryKey,
        memory_value: memoryValue,
        category,
        lead_id: leadId || null,
        is_shared: isShared,
      };

      // Upsert by key+lead
      const { data: existing } = await (supabase
        .from('ai_memory' as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('memory_key', memoryKey)
        .eq('lead_id', leadId || null) as any)
        .limit(1);

      if (existing?.length) {
        const { data, error } = await (supabase
          .from('ai_memory' as any)
          .update({ memory_value: memoryValue, category })
          .eq('id', existing[0].id)
          .select() as any);
        if (error) throw error;
        return data?.[0];
      }

      const { data, error } = await (supabase
        .from('ai_memory' as any)
        .insert(record)
        .select() as any);
      if (error) throw error;
      return data?.[0];
    } catch (err) {
      console.error('Error saving AI memory:', err);
      return null;
    }
  }, [user]);

  const deleteMemory = useCallback(async (memoryId: string) => {
    if (!user) return false;
    try {
      const { error } = await (supabase
        .from('ai_memory' as any)
        .delete()
        .eq('id', memoryId)
        .eq('user_id', user.id) as any);
      if (error) throw error;
      setMemories(prev => prev.filter(m => m.id !== memoryId));
      return true;
    } catch (err) {
      console.error('Error deleting AI memory:', err);
      return false;
    }
  }, [user]);

  return { memories, loading, fetchMemories, saveMemory, deleteMemory };
}
