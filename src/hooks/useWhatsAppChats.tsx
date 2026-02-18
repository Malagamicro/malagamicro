import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { fetchAllChats, fetchChatMessages, extractMessageContent, formatPhoneNumber, fetchProfilePicture } from '@/services/evolutionService';
import { toast } from 'sonner';

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
  lastMessage?: string;
  folderId?: string | null;
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
    folderId: row.folder_id,
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
    staleTime: 5000, // Consider data fresh for 5 seconds
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

      const { data: existingChat, error: fetchError } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('user_id', user.id)
        .eq('chat_id', chatId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingChat) {
        return mapChatRow(existingChat);
      }

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

      const { data: chat } = await supabase
        .from('whatsapp_chats')
        .select('unread_count')
        .eq('user_id', user.id)
        .eq('chat_id', chatId)
        .maybeSingle();

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
      staleTime: 2000, // Consider messages fresh for 2 seconds
    });
  };

  // Sync chats from Evolution API
  const syncFromEvolution = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const evolutionChats = await fetchAllChats();
      if (evolutionChats.length === 0) {
        toast.info('No se encontraron chats en Evolution API');
        return { synced: 0, messages: 0 };
      }

      let syncedChats = 0;
      let syncedMessages = 0;

      for (const chat of evolutionChats) {
        const phone = chat.remoteJid.replace(/@s\.whatsapp\.net$/, '');
        const chatId = chat.remoteJid;

        // Upsert chat
        const { data: existingChat } = await supabase
          .from('whatsapp_chats')
          .select('id, avatar_url')
          .eq('user_id', user.id)
          .eq('chat_id', chatId)
          .maybeSingle();

        // Fetch profile picture if not already set
        let avatarUrl = existingChat?.avatar_url || chat.profilePicUrl || null;
        if (!avatarUrl) {
          try {
            const picUrl = await fetchProfilePicture(chatId);
            if (picUrl) avatarUrl = picUrl;
          } catch { /* ignore */ }
        }

        if (!existingChat) {
          await supabase.from('whatsapp_chats').insert({
            user_id: user.id,
            chat_id: chatId,
            phone,
            custom_name: chat.name || null,
            avatar_url: avatarUrl,
            last_message_at: chat.lastMsgTimestamp
              ? new Date(chat.lastMsgTimestamp * 1000).toISOString()
              : new Date().toISOString(),
            unread_count: chat.unreadMessages || 0,
          });
          syncedChats++;
        } else {
          // Update name, avatar & unread if we have new data
          const updates: any = {};
          if (chat.name) updates.custom_name = chat.name;
          if (avatarUrl && !existingChat.avatar_url) updates.avatar_url = avatarUrl;
          if (chat.unreadMessages !== undefined) updates.unread_count = chat.unreadMessages;
          
          if (Object.keys(updates).length > 0) {
            await supabase
              .from('whatsapp_chats')
              .update(updates)
              .eq('id', existingChat.id);
          }
        }

        // Fetch and sync last messages for this chat
        const messages = await fetchChatMessages(chatId, 30);
        
        for (const msg of messages) {
          if (!msg.key?.id) continue;

          // Check if message already exists
          const { data: existingMsg } = await supabase
            .from('waha_messages')
            .select('id')
            .eq('message_id', msg.key.id)
            .maybeSingle();

          if (existingMsg) continue;

          const content = extractMessageContent(msg);
          const msgType = msg.message?.imageMessage ? 'image'
            : msg.message?.videoMessage ? 'video'
            : msg.message?.documentMessage ? 'document'
            : 'text';

          const timestamp = msg.messageTimestamp
            ? new Date(msg.messageTimestamp * 1000).toISOString()
            : new Date().toISOString();

          await supabase.from('waha_messages').insert({
            chat_id: chatId,
            content: content || (msgType !== 'text' ? `[${msgType}]` : ''),
            from_me: msg.key.fromMe ?? false,
            timestamp,
            user_id: user.id,
            message_id: msg.key.id,
            media_url: msg.mediaUrl || null,
            message_type: msgType,
          });
          syncedMessages++;
        }
      }

      return { synced: syncedChats, messages: syncedMessages };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      toast.success(`Sincronización completada: ${result.synced} chats nuevos, ${result.messages} mensajes importados`);
    },
    onError: (error: Error) => {
      toast.error(`Error al sincronizar: ${error.message}`);
    },
  });

  // Auto-sync every 5 minutes in the background
  const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useEffect(() => {
    if (!user?.id) return;
    
    // Initial silent sync after 10 seconds
    const initialTimeout = setTimeout(() => {
      syncFromEvolution.mutate(undefined, {
        onSuccess: (result) => {
          // Silent - no toast for auto-sync, only log
          console.log(`🔄 Auto-sync: ${result.synced} chats, ${result.messages} messages`);
          queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
        },
        onError: () => { /* silent */ },
      });
    }, 10000);

    // Then every 5 minutes
    autoSyncRef.current = setInterval(() => {
      if (!syncFromEvolution.isPending) {
        syncFromEvolution.mutate(undefined, {
          onSuccess: (result) => {
            console.log(`🔄 Auto-sync: ${result.synced} chats, ${result.messages} messages`);
            queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
            queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
          },
          onError: () => { /* silent */ },
        });
      }
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (autoSyncRef.current) clearInterval(autoSyncRef.current);
    };
  }, [user?.id]);

  // NOTE: Realtime subscriptions are now handled by useRealtimeConnection hook
  // This prevents duplicate subscriptions and provides centralized connection management

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
    syncFromEvolution: syncFromEvolution.mutateAsync,
    isSyncing: syncFromEvolution.isPending,
  };
}