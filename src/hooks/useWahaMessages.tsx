import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
  createdAt: Date;
}

export interface ChatSummary {
  chatId: string;
  leadId: string | null;
  lastMessage: string;
  lastTimestamp: Date;
  unreadCount: number;
  leadName?: string;
  leadCompany?: string;
}

function mapRowToMessage(row: any): WahaMessage {
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
    createdAt: new Date(row.created_at),
  };
}

export function useWahaMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get chat list with last message
  const chatsQuery = useQuery({
    queryKey: ['waha-chats'],
    queryFn: async (): Promise<ChatSummary[]> => {
      const { data, error } = await supabase
        .from('waha_messages')
        .select(`
          chat_id,
          content,
          timestamp,
          lead_id,
          leads(company_name, contact_name)
        `)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Group by chat_id and get the latest message for each
      const chatMap = new Map<string, ChatSummary>();
      
      for (const row of data || []) {
        if (!chatMap.has(row.chat_id)) {
          const lead = row.leads as { company_name?: string; contact_name?: string } | null;
          chatMap.set(row.chat_id, {
            chatId: row.chat_id,
            leadId: row.lead_id,
            lastMessage: row.content,
            lastTimestamp: new Date(row.timestamp),
            unreadCount: 0,
            leadName: lead?.contact_name || undefined,
            leadCompany: lead?.company_name || undefined,
          });
        }
      }

      return Array.from(chatMap.values()).sort(
        (a, b) => b.lastTimestamp.getTime() - a.lastTimestamp.getTime()
      );
    },
    enabled: !!user,
  });

  // Get messages for a specific chat
  const useMessagesForChat = (chatId: string | null) => {
    return useQuery({
      queryKey: ['waha-messages', chatId],
      queryFn: async (): Promise<WahaMessage[]> => {
        if (!chatId) return [];
        
        const { data, error } = await supabase
          .from('waha_messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('timestamp', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapRowToMessage);
      },
      enabled: !!user && !!chatId,
    });
  };

  // Insert a sent message into the database
  const sendMessageMutation = useMutation({
    mutationFn: async ({ 
      chatId, 
      content, 
      leadId 
    }: { 
      chatId: string; 
      content: string; 
      leadId?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase.from('waha_messages').insert({
        chat_id: chatId,
        content,
        from_me: true,
        lead_id: leadId || null,
        user_id: user.id,
        timestamp: new Date().toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['waha-chats'] });
      queryClient.invalidateQueries({ queryKey: ['waha-messages', variables.chatId] });
    },
  });

  // NOTE: Realtime subscriptions are now handled by useRealtimeConnection hook
  // This prevents duplicate subscriptions and provides centralized connection management

  return {
    chats: chatsQuery.data || [],
    isLoadingChats: chatsQuery.isLoading,
    chatsError: chatsQuery.error,
    useMessagesForChat,
    sendMessage: sendMessageMutation.mutate,
    isSendingMessage: sendMessageMutation.isPending,
    refetchChats: chatsQuery.refetch,
  };
}
