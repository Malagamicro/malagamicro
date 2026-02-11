import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SharedFolder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  owner?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface SharedFile {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string | null;
  description: string | null;
  folder_id: string | null;
  folder_path: string;
  created_at: string;
  updated_at: string;
  uploader?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useSharedFolders(parentId: string | null = null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['shared-folders', parentId],
    queryFn: async (): Promise<SharedFolder[]> => {
      let query = supabase
        .from('shared_folders')
        .select('*')
        .order('name', { ascending: true });

      if (parentId === null) {
        query = query.is('parent_id', null);
      } else {
        query = query.eq('parent_id', parentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get owner profiles
      const userIds = [...new Set((data || []).map(f => f.user_id))];
      if (userIds.length === 0) return data || [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (data || []).map(folder => ({
        ...folder,
        owner: profileMap.get(folder.user_id),
      }));
    },
    enabled: !!user,
  });

  const createFolder = useMutation({
    mutationFn: async ({ name, parentId: parent, color }: { name: string; parentId?: string | null; color?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('shared_folders')
        .insert({
          user_id: user.id,
          name,
          parent_id: parent || null,
          color: color || '#6366f1',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-folders'] });
      toast.success('Carpeta creada');
    },
    onError: () => {
      toast.error('Error al crear carpeta');
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase
        .from('shared_folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-folders'] });
      queryClient.invalidateQueries({ queryKey: ['shared-files'] });
      toast.success('Carpeta eliminada');
    },
    onError: () => {
      toast.error('Error al eliminar carpeta');
    },
  });

  const renameFolder = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('shared_folders')
        .update({ name })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-folders'] });
      toast.success('Carpeta renombrada');
    },
    onError: () => {
      toast.error('Error al renombrar carpeta');
    },
  });

  return {
    folders,
    isLoading,
    createFolder,
    deleteFolder,
    renameFolder,
  };
}

export function useSharedFiles(folderId: string | null = null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['shared-files', folderId],
    queryFn: async (): Promise<SharedFile[]> => {
      let query = supabase
        .from('shared_files')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (folderId === null) {
        query = query.is('folder_id', null);
      } else {
        query = query.eq('folder_id', folderId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get uploader profiles
      const userIds = [...new Set((data || []).map(f => f.user_id))];
      if (userIds.length === 0) return data || [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (data || []).map(file => ({
        ...file,
        uploader: profileMap.get(file.user_id),
      }));
    },
    enabled: !!user,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ 
      file, 
      description,
      folderId: targetFolder,
    }: { 
      file: File; 
      description?: string;
      folderId?: string | null;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('shared-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('shared-files')
        .getPublicUrl(fileName);

      // Save metadata
      const { error: dbError } = await supabase
        .from('shared_files')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: publicUrl,
          file_size: file.size,
          file_type: file.type || null,
          description: description || null,
          folder_id: targetFolder || null,
          folder_path: '/',
        });

      if (dbError) throw dbError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-files'] });
      toast.success('Archivo subido correctamente');
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error('Error al subir archivo');
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get file info first
      const { data: file, error: fetchError } = await supabase
        .from('shared_files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (fetchError) throw fetchError;

      // Only owner can delete
      if (file.user_id !== user.id) {
        throw new Error('No tienes permiso para eliminar este archivo');
      }

      // Extract storage path from URL
      try {
        const url = new URL(file.file_path);
        const storagePath = url.pathname.split('/shared-files/')[1];

        if (storagePath) {
          await supabase.storage
            .from('shared-files')
            .remove([decodeURIComponent(storagePath)]);
        }
      } catch (e) {
        console.warn('Could not delete storage file:', e);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('shared_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-files'] });
      toast.success('Archivo eliminado');
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast.error(error.message || 'Error al eliminar archivo');
    },
  });

  const updateDescription = useMutation({
    mutationFn: async ({ fileId, description }: { fileId: string; description: string }) => {
      const { error } = await supabase
        .from('shared_files')
        .update({ description })
        .eq('id', fileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-files'] });
      toast.success('Descripción actualizada');
    },
    onError: () => {
      toast.error('Error al actualizar descripción');
    },
  });

  const moveFile = useMutation({
    mutationFn: async ({ fileId, folderId: targetFolderId }: { fileId: string; folderId: string | null }) => {
      const { error } = await supabase
        .from('shared_files')
        .update({ folder_id: targetFolderId })
        .eq('id', fileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-files'] });
      toast.success('Archivo movido');
    },
    onError: () => {
      toast.error('Error al mover archivo');
    },
  });

  const reorderFiles = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update sort_order for each file
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('shared_files')
          .update({ sort_order: index })
          .eq('id', id)
      );
      const results = await Promise.all(updates);
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-files'] });
    },
    onError: () => {
      toast.error('Error al reordenar archivos');
    },
  });

  return {
    files,
    isLoading,
    uploadFile,
    deleteFile,
    updateDescription,
    moveFile,
    reorderFiles,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
