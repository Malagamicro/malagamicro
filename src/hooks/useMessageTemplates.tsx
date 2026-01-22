import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface MessageTemplate {
  id: string;
  userId: string;
  name: string;
  content: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

function mapRowToTemplate(row: any): MessageTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    content: row.content,
    category: row.category || 'general',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function useMessageTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ['message-templates'],
    queryFn: async (): Promise<MessageTemplate[]> => {
      // Use 'any' to bypass type checking until types are regenerated
      const { data, error } = await (supabase as any)
        .from('message_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapRowToTemplate);
    },
    enabled: !!user,
  });

  const createTemplate = useMutation({
    mutationFn: async ({ name, content, category }: { name: string; content: string; category?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await (supabase as any).from('message_templates').insert({
        user_id: user.id,
        name,
        content,
        category: category || 'general',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({
        title: 'Plantilla creada',
        description: 'La plantilla se ha guardado correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo crear la plantilla.',
        variant: 'destructive',
      });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, name, content, category }: { id: string; name: string; content: string; category?: string }) => {
      const { error } = await (supabase as any)
        .from('message_templates')
        .update({ name, content, category: category || 'general' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({
        title: 'Plantilla actualizada',
        description: 'Los cambios se han guardado.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la plantilla.',
        variant: 'destructive',
      });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({
        title: 'Plantilla eliminada',
        description: 'La plantilla se ha eliminado.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la plantilla.',
        variant: 'destructive',
      });
    },
  });

  return {
    templates: templatesQuery.data || [],
    isLoading: templatesQuery.isLoading,
    error: templatesQuery.error,
    createTemplate: createTemplate.mutate,
    updateTemplate: updateTemplate.mutate,
    deleteTemplate: deleteTemplate.mutate,
    isCreating: createTemplate.isPending,
    isUpdating: updateTemplate.isPending,
    isDeleting: deleteTemplate.isPending,
  };
}
