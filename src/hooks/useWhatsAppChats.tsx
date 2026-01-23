import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useEffect } from 'react';

export interface WhatsAppChat {
  id: string;
  userId: string;
  chatId: string;
  phone: string;
  customName: string | null;
  avatarUrl: string | null;
  isArchived: boolean;
  lastMessageAt: Date;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
  // Computed from last message
  lastMessage?: string;
}

export interface WahaMessage {
  id: string;
  chatId: string;
  content: string;
  fromMe: boolean;
  timestamp: Date;
  leadId: string | null;
  userId: string;
  messageId: string | null;
  mediaUrl: string | null;
  messageType: string | null;
  ackStatus: string | null;
  reaction: string | null;
  isRevoked: boolean;
  isEdited: boolean;
  replyToId: string | null;
  createdAt: Date;
}

function mapChatRow(row: any): WhatsAppChat {
  return {
    id: row.id,
    userId: row.user_id,
    chatId: row.chat_id,
    phone: row.phone,
    customName: row.custom_name,
    avatarUrl: row.avatar_url,
    isArchived: row.is_archived,
    lastMessageAt: new Date(row.last_message_at),
    unreadCount: row.unread_count || 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastMessage: row.last_message,
  };
}

function mapMessageRow(row: any): WahaMessage {
  return {
    id: row.id,
    chatId: row.chat_id,
    content: row.content,
    fromMe: row.from_me,
    timestamp: new Date(row.timestamp),
    leadId: row.lead_id,
    userId: row.user_id,
    messageId: row.message_id,
    mediaUrl: row.media_url,
    messageType: row.message_type,
    ackStatus: row.ack_status,
    reaction: row.reaction,
    isRevoked: row.is_revoked || false,
    isEdited: row.is_edited || false,
    replyToId: row.reply_to_id,
    createdAt: new Date(row.created_at),
  };
}

export function useWhatsAppChats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all chats with last message
  const chatsQuery = useQuery({
    queryKey: ['whatsapp-chats'],
    queryFn: async (): Promise<WhatsAppChat[]> => {
      // First get all chats
      const { data: chats, error: chatsError } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false });

      if (chatsError) throw chatsError;

      // Then get last message for each chat
      const chatsWithMessages = await Promise.all(
        (chats || []).map(async (chat: any) => {
          const { data: messages } = await supabase
            .from('waha_messages')
            .select('content')
            .eq('chat_id', chat.chat_id)
            .order('timestamp', { ascending: false })
            .limit(1);

          return {
            ...chat,
            last_message: messages?.[0]?.content || '',
          };
        })
      );

      return chatsWithMessages.map(mapChatRow);
    },
    enabled: !!user,
  });

  // Get or create a chat
  const getOrCreateChat = useMutation({
    mutationFn: async ({ 
      chatId, 
      phone, 
      customName 
    }: { 
      chatId: string; 
      phone: string; 
      customName?: string;
    }): Promise<WhatsAppChat> => {
      if (!user?.id) throw new Error('User not authenticated');

      // Check if chat exists
      const { data: existingChat, error: fetchError } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('user_id', user.id)
        .eq('chat_id', chatId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingChat) {
        return mapChatRow(existingChat);
      }

      // Create new chat
      const { data: newChat, error: insertError } = await supabase
        .from('whatsapp_chats')
        .insert({
          user_id: user.id,
          chat_id: chatId,
          phone,
          custom_name: customName || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return mapChatRow(newChat);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
    },
  });

  // Update chat info (name, avatar)
  const updateChat = useMutation({
    mutationFn: async ({ 
      chatId, 
      customName, 
      avatarUrl 
    }: { 
      chatId: string; 
      customName?: string; 
      avatarUrl?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const updates: any = { updated_at: new Date().toISOString() };
      if (customName !== undefined) updates.custom_name = customName;
      if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

      const { error } = await supabase
        .from('whatsapp_chats')
        .update(updates)
        .eq('user_id', user.id)
        .eq('chat_id', chatId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
    },
  });

  // Update last message timestamp and reset unread
  const updateChatLastMessage = useMutation({
    mutationFn: async ({ chatId, resetUnread = false }: { chatId: string; resetUnread?: boolean }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const updates: any = { 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      if (resetUnread) {
        updates.unread_count = 0;
      }

      const { error } = await supabase
        .from('whatsapp_chats')
        .update(updates)
        .eq('user_id', user.id)
        .eq('chat_id', chatId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
    },
  });

  // Increment unread count
  const incrementUnread = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Get current count
      const { data: chat } = await supabase
        .from('whatsapp_chats')
        .select('unread_count')
        .eq('user_id', user.id)
        .eq('chat_id', chatId)
        .single();

      const currentCount = chat?.unread_count || 0;

      const { error } = await supabase
        .from('whatsapp_chats')
        .update({ 
          unread_count: currentCount + 1,
          last_message_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('chat_id', chatId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
    },
  });

  // Upload avatar
  const uploadAvatar = async (chatId: string, file: File): Promise<string> => {
    if (!user?.id) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${chatId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-avatars')
      .getPublicUrl(fileName);

    // Update chat with new avatar URL
    await updateChat.mutateAsync({ chatId, avatarUrl: publicUrl });

    return publicUrl;
  };

  // Get messages for a specific chat
  const useMessagesForChat = (chatId: string | null) => {
    return useQuery({
      queryKey: ['whatsapp-messages', chatId],
      queryFn: async (): Promise<WahaMessage[]> => {
        if (!chatId) return [];
        
        const { data, error } = await supabase
          .from('waha_messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('timestamp', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapMessageRow);
      },
      enabled: !!user && !!chatId,
    });
  };

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to chats changes
    const chatsChannel = supabase
      .channel('whatsapp-chats-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_chats',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
        }
      )
      .subscribe();

    // Subscribe to messages changes
    const messagesChannel = supabase
      .channel('whatsapp-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waha_messages',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('📩 Message update:', payload);
          queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
          const msg = payload.new as any;
          if (msg?.chat_id) {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', msg.chat_id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user, queryClient]);

  return {
    chats: chatsQuery.data || [],
    isLoadingChats: chatsQuery.isLoading,
    chatsError: chatsQuery.error,
    refetchChats: chatsQuery.refetch,
    getOrCreateChat: getOrCreateChat.mutateAsync,
    updateChat: updateChat.mutateAsync,
    updateChatLastMessage: updateChatLastMessage.mutateAsync,
    incrementUnread: incrementUnread.mutateAsync,
    uploadAvatar,
    useMessagesForChat,
    isCreatingChat: getOrCreateChat.isPending,
  };
}