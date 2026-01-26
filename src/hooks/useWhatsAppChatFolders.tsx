import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface WhatsAppChatFolder {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

function mapFolderRow(row: any): WhatsAppChatFolder {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function useWhatsAppChatFolders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all folders
  const foldersQuery = useQuery({
    queryKey: ['whatsapp-chat-folders'],
    queryFn: async (): Promise<WhatsAppChatFolder[]> => {
      const { data, error } = await supabase
        .from('whatsapp_chat_folders')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapFolderRow);
    },
    enabled: !!user,
  });

  // Create a folder
  const createFolder = useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }): Promise<WhatsAppChatFolder> => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('whatsapp_chat_folders')
        .insert({
          user_id: user.id,
          name,
          color: color || '#6366f1',
        })
        .select()
        .single();

      if (error) throw error;
      return mapFolderRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chat-folders'] });
      toast.success('Carpeta creada');
    },
    onError: (error) => {
      toast.error('Error al crear carpeta: ' + error.message);
    },
  });

  // Update a folder
  const updateFolder = useMutation({
    mutationFn: async ({ 
      folderId, 
      name, 
      color 
    }: { 
      folderId: string; 
      name?: string; 
      color?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const updates: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;

      const { error } = await supabase
        .from('whatsapp_chat_folders')
        .update(updates)
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chat-folders'] });
    },
  });

  // Delete a folder
  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('whatsapp_chat_folders')
        .delete()
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chat-folders'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      toast.success('Carpeta eliminada');
    },
    onError: (error) => {
      toast.error('Error al eliminar carpeta: ' + error.message);
    },
  });

  // Assign chat to folder
  const assignChatToFolder = useMutation({
    mutationFn: async ({ chatId, folderId }: { chatId: string; folderId: string | null }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('whatsapp_chats')
        .update({ folder_id: folderId })
        .eq('chat_id', chatId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      toast.success('Chat movido');
    },
    onError: (error) => {
      toast.error('Error al mover chat: ' + error.message);
    },
  });

  // Delete a chat (archive it)
  const deleteChat = useMutation({
    mutationFn: async (chatId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('whatsapp_chats')
        .update({ is_archived: true })
        .eq('chat_id', chatId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      toast.success('Chat eliminado');
    },
    onError: (error) => {
      toast.error('Error al eliminar chat: ' + error.message);
    },
  });

  return {
    folders: foldersQuery.data || [],
    isLoadingFolders: foldersQuery.isLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    assignChatToFolder,
    deleteChat,
  };
}
