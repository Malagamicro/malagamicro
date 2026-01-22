import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface LeadFolder {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FolderRow {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

function mapRowToFolder(row: FolderRow): LeadFolder {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    userId: row.user_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function useLeadFolders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: folders = [], isLoading, error } = useQuery({
    queryKey: ['lead-folders'],
    queryFn: async () => {
      // Using 'as any' because types will be updated after migration sync
      const { data, error } = await (supabase as any)
        .from('lead_folders')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return (data as FolderRow[]).map(mapRowToFolder);
    },
    enabled: !!user,
  });

  const createFolder = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      // Using 'as any' because types will be updated after migration sync
      const { data, error } = await (supabase as any)
        .from('lead_folders')
        .insert({
          name,
          color,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapRowToFolder(data as FolderRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-folders'] });
      toast({
        title: 'Carpeta creada',
        description: 'La carpeta se ha creado correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudo crear la carpeta.',
        variant: 'destructive',
      });
      console.error('Error creating folder:', error);
    },
  });

  const updateFolder = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      // Using 'as any' because types will be updated after migration sync
      const { error } = await (supabase as any)
        .from('lead_folders')
        .update({ name, color })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-folders'] });
      toast({
        title: 'Carpeta actualizada',
        description: 'La carpeta se ha actualizado correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la carpeta.',
        variant: 'destructive',
      });
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      // Using 'as any' because types will be updated after migration sync
      const { error } = await (supabase as any)
        .from('lead_folders')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-folders'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Carpeta eliminada',
        description: 'La carpeta se ha eliminado. Los leads en esta carpeta ahora están sin carpeta.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la carpeta.',
        variant: 'destructive',
      });
    },
  });

  return {
    folders,
    isLoading,
    error,
    createFolder: createFolder.mutate,
    updateFolder: updateFolder.mutate,
    deleteFolder: deleteFolder.mutate,
    isCreating: createFolder.isPending,
    isUpdating: updateFolder.isPending,
    isDeleting: deleteFolder.isPending,
  };
}
