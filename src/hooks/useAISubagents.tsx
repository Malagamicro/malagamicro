import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AISubagent {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  model: string;
  role_prompt: string;
  agent_type: 'text' | 'image' | 'audio';
  avatar_emoji: string;
  avatar_color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAISubagents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ai-subagents'],
    queryFn: async (): Promise<AISubagent[]> => {
      const { data, error } = await supabase
        .from('ai_subagents' as any)
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (agent: Omit<AISubagent, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('No autenticado');
      const { data, error } = await supabase
        .from('ai_subagents' as any)
        .insert({ ...agent, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-subagents'] });
      toast.success('Subagente creado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AISubagent> & { id: string }) => {
      const { error } = await supabase
        .from('ai_subagents' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-subagents'] });
      toast.success('Subagente actualizado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_subagents' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-subagents'] });
      toast.success('Subagente eliminado');
    },
    onError: (e: any) => toast.error('Error: ' + e.message),
  });

  return {
    subagents: query.data || [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
  };
}
