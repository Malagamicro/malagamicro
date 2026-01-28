import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SharedFile {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string | null;
  description: string | null;
  folder_path: string;
  created_at: string;
  updated_at: string;
  uploader?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useSharedFiles(folderPath: string = '/') {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['shared-files', folderPath],
    queryFn: async (): Promise<SharedFile[]> => {
      const { data, error } = await supabase
        .from('shared_files')
        .select('*')
        .eq('folder_path', folderPath)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get uploader profiles
      const userIds = [...new Set((data || []).map(f => f.user_id))];
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
      folderPath: targetFolder = '/' 
    }: { 
      file: File; 
      description?: string;
      folderPath?: string;
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
          folder_path: targetFolder,
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
      const url = new URL(file.file_path);
      const storagePath = url.pathname.split('/shared-files/')[1];

      if (storagePath) {
        await supabase.storage
          .from('shared-files')
          .remove([storagePath]);
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

  return {
    files,
    isLoading,
    uploadFile,
    deleteFile,
    updateDescription,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
