import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

interface NotificationContextType {
  permission: NotificationPermission;
  unreadCount: number;
  soundEnabled: boolean;
  requestPermission: () => Promise<NotificationPermission | 'denied'>;
  toggleSound: () => void;
  refreshUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    permission,
    unreadCount,
    soundEnabled,
    requestPermission,
    handleNewMessage,
    toggleSound,
    refreshUnreadCount,
  } = useNotifications();

  // Request permission on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      // Wait a bit before requesting to avoid being intrusive
      const timer = setTimeout(() => {
        requestPermission();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [requestPermission]);

  // Subscribe to incoming WhatsApp messages for notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`whatsapp-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'waha_messages',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const msg = payload.new as { 
            from_me: boolean; 
            content: string; 
            chat_id: string;
          };
          
          // Only notify for incoming messages
          if (msg.from_me) return;

          console.log('🔔 New WhatsApp message, triggering notification');
          
          // Try to get chat name
          const { data: chat } = await supabase
            .from('whatsapp_chats')
            .select('custom_name, phone')
            .eq('chat_id', msg.chat_id)
            .maybeSingle();

          const senderName = chat?.custom_name || chat?.phone || 'WhatsApp';
          handleNewMessage(`📱 ${senderName}`, msg.content);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, handleNewMessage]);

  // Subscribe to internal chat messages for notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`internal-chat-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages',
        },
        async (payload) => {
          const msg = payload.new as { 
            sender_id: string; 
            content: string | null; 
            conversation_id: string;
            message_type: string;
          };
          
          // Don't notify for own messages
          if (msg.sender_id === user.id) return;

          // Check if user is participant of this conversation
          const { data: participation } = await supabase
            .from('conversation_participants')
            .select('id')
            .eq('conversation_id', msg.conversation_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!participation) return;

          console.log('🔔 New internal message, triggering notification');
          
          // Get sender name
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', msg.sender_id)
            .maybeSingle();

          const senderName = senderProfile?.full_name || 'Usuario';
          const messagePreview = msg.message_type === 'text' 
            ? (msg.content || 'Mensaje')
            : msg.message_type === 'image' 
              ? '📷 Imagen'
              : '📎 Archivo';
          
          handleNewMessage(`💬 ${senderName}`, messagePreview);
          
          // Invalidate internal conversations to update unread counts
          queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, handleNewMessage, queryClient]);

  return (
    <NotificationContext.Provider
      value={{
        permission,
        unreadCount,
        soundEnabled,
        requestPermission,
        toggleSound,
        refreshUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}
