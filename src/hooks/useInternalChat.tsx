import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants?: Participant[];
  last_message?: InternalMessage;
  unread_count?: number;
}

export interface Participant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  is_admin: boolean;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface InternalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useInternalChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Fetch all conversations for the current user
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['internal-conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (partError) throw partError;
      if (!participations?.length) return [];

      const convIds = participations.map(p => p.conversation_id);

      const { data: convs, error } = await supabase
        .from('internal_conversations')
        .select('*')
        .in('id', convIds)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('*')
        .in('conversation_id', convIds);

      const userIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const conversationsWithDetails = await Promise.all(
        (convs || []).map(async (conv) => {
          const participants = allParticipants
            ?.filter(p => p.conversation_id === conv.id)
            .map(p => ({ ...p, profile: profileMap.get(p.user_id) })) || [];

          const { data: lastMessages } = await supabase
            .from('internal_messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const myParticipation = participants.find(p => p.user_id === user.id);
          const lastReadAt = myParticipation?.last_read_at;

          let unreadCount = 0;
          if (lastReadAt) {
            const { count } = await supabase
              .from('internal_messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .gt('created_at', lastReadAt)
              .neq('sender_id', user.id);
            unreadCount = count || 0;
          }

          return { ...conv, participants, last_message: lastMessages?.[0], unread_count: unreadCount };
        })
      );

      return conversationsWithDetails as Conversation[];
    },
    enabled: !!user?.id,
  });

  // Fetch messages for active conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['internal-messages', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];

      const { data, error } = await supabase
        .from('internal_messages')
        .select('*')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (data || []).map(m => ({ ...m, sender: profileMap.get(m.sender_id) })) as InternalMessage[];
    },
    enabled: !!activeConversationId,
  });

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: async ({ participantIds, name, isGroup }: { 
      participantIds: string[]; name?: string; isGroup?: boolean;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      if (!isGroup && participantIds.length === 1) {
        const existingConv = conversations.find(c => 
          !c.is_group && c.participants?.length === 2 &&
          c.participants.some(p => p.user_id === participantIds[0])
        );
        if (existingConv) return existingConv;
      }

      const { data: conv, error: convError } = await supabase
        .from('internal_conversations')
        .insert({ name: name || null, is_group: isGroup || false, created_by: user.id })
        .select().single();

      if (convError) throw convError;

      await supabase.from('conversation_participants')
        .insert({ conversation_id: conv.id, user_id: user.id, is_admin: true });

      if (participantIds.length > 0) {
        await supabase.from('conversation_participants')
          .insert(participantIds.map(userId => ({ conversation_id: conv.id, user_id: userId, is_admin: false })));
      }

      return conv;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['internal-conversations'] }); },
    onError: () => { toast.error('Error al crear conversación'); },
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ content, messageType = 'text', fileUrl, fileName, fileSize, replyToId }: {
      content?: string; messageType?: string; fileUrl?: string; fileName?: string; fileSize?: number; replyToId?: string;
    }) => {
      if (!user?.id || !activeConversationId) throw new Error('Missing context');

      const { data, error } = await supabase
        .from('internal_messages')
        .insert({
          conversation_id: activeConversationId, sender_id: user.id,
          content: content || null, message_type: messageType,
          file_url: fileUrl || null, file_name: fileName || null,
          file_size: fileSize || null, reply_to_id: replyToId || null,
        }).select().single();

      if (error) throw error;

      await supabase.from('internal_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConversationId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages', activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
    },
    onError: () => { toast.error('Error al enviar mensaje'); },
  });

  // Edit message
  const editMessage = useMutation({
    mutationFn: async ({ messageId, newContent }: { messageId: string; newContent: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('internal_messages')
        .update({ content: newContent, is_edited: true, updated_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages', activeConversationId] });
      toast.success('Mensaje editado');
    },
    onError: () => { toast.error('Error al editar mensaje'); },
  });

  // Delete message (soft delete)
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('internal_messages')
        .update({ is_deleted: true, content: null, updated_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages', activeConversationId] });
      toast.success('Mensaje eliminado');
    },
    onError: () => { toast.error('Error al eliminar mensaje'); },
  });

  // Leave conversation
  const leaveConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      setActiveConversationId(null);
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
      toast.success('Has salido de la conversación');
    },
    onError: () => { toast.error('Error al salir de la conversación'); },
  });

  // Update group name
  const updateGroup = useMutation({
    mutationFn: async ({ conversationId, name }: { conversationId: string; name: string }) => {
      const { error } = await supabase
        .from('internal_conversations')
        .update({ name })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
      toast.success('Grupo actualizado');
    },
    onError: () => { toast.error('Error al actualizar grupo'); },
  });

  // Remove participant from group
  const removeParticipant = useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
      toast.success('Participante eliminado');
    },
    onError: () => { toast.error('Error al eliminar participante'); },
  });

  // Upload file
  const uploadFile = async (file: File): Promise<{ url: string; name: string; size: number }> => {
    if (!user?.id) throw new Error('Not authenticated');
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('chat-files').upload(fileName, file);
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(fileName);
    return { url: publicUrl, name: file.name, size: file.size };
  };

  // Mark conversation as read
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!user?.id) return;
    await supabase.from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
  }, [user?.id, queryClient]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user?.id) return;

    const messagesChannel = supabase
      .channel('internal-messages-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
        queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(messagesChannel); };
  }, [user?.id, queryClient]);

  // Mark active conversation as read
  useEffect(() => {
    if (activeConversationId) markAsRead(activeConversationId);
  }, [activeConversationId, markAsRead]);

  return {
    conversations, conversationsLoading, messages, messagesLoading,
    activeConversationId, setActiveConversationId,
    createConversation, sendMessage, uploadFile, markAsRead,
    editMessage, deleteMessage, leaveConversation, updateGroup, removeParticipant,
  };
}

export function useAllUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['all-users', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .neq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}
