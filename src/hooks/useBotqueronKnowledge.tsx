import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useBotqueronKnowledge() {
  const qc = useQueryClient();
  const key = ['botqueron-knowledge'];

  const { data: docs = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('botqueron_knowledge')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as KnowledgeDoc[];
    },
  });

  const addDoc = useMutation({
    mutationFn: async (doc: Omit<KnowledgeDoc, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await (supabase as any).from('botqueron_knowledge').insert(doc);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Documento añadido a la base de conocimiento'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateDoc = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KnowledgeDoc> & { id: string }) => {
      const { error } = await (supabase as any)
        .from('botqueron_knowledge')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Documento actualizado'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('botqueron_knowledge').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Documento eliminado'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { docs, isLoading, addDoc, updateDoc, deleteDoc };
}
