import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface NotificationContextType {
  permission: NotificationPermission;
  unreadCount: number;
  soundEnabled: boolean;
  requestPermission: () => Promise<NotificationPermission | 'denied'>;
  sendTestNotification: () => Promise<{ ok: boolean; method: string; error?: string }>;
  toggleSound: () => void;
  refreshUnreadCount: () => void;
  showPermissionBanner: boolean;
  dismissBanner: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  
  const {
    permission,
    unreadCount,
    soundEnabled,
    requestPermission,
    handleNewMessage,
    sendTestNotification,
    toggleSound,
    refreshUnreadCount,
  } = useNotifications();

  // Show permission banner if not granted and not dismissed
  useEffect(() => {
    if (typeof Notification !== 'undefined' && 
        Notification.permission !== 'granted' && 
        !bannerDismissed) {
      setShowPermissionBanner(true);
    } else {
      setShowPermissionBanner(false);
    }
  }, [permission, bannerDismissed]);

  const handleRequestPermission = async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      toast({
        title: '⚠️ Notificaciones bloqueadas',
        description: 'Tienes las notificaciones bloqueadas en el navegador. Pulsa en el candado de la URL para permitirlas.',
      });
      return 'denied' as NotificationPermission;
    }

    const result = await requestPermission();
    if (result === 'granted') {
      setShowPermissionBanner(false);
    } else if (result === 'denied') {
      toast({
        title: '⚠️ Notificaciones bloqueadas',
        description: 'Tienes las notificaciones bloqueadas en el navegador. Pulsa en el candado de la URL para permitirlas.',
      });
    }
    return result;
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    setShowPermissionBanner(false);
  };

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

  // Subscribe to reminders that are due
  useEffect(() => {
    if (!user?.id) return;

    // Check for due reminders every minute
    const checkReminders = async () => {
      const now = new Date();
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
      
      const { data: dueReminders } = await supabase
        .from('follow_up_reminders')
        .select('id, message, reminder_date, leads(company_name)')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .gte('reminder_date', now.toISOString())
        .lte('reminder_date', fiveMinutesLater.toISOString());

      if (dueReminders && dueReminders.length > 0) {
        for (const reminder of dueReminders) {
          const lead = reminder.leads as { company_name?: string } | null;
          const title = `⏰ Recordatorio`;
          const body = reminder.message || `Seguimiento: ${lead?.company_name || 'Lead'}`;
          handleNewMessage(title, body);
        }
      }
    };

    // Check immediately and then every minute
    checkReminders();
    const interval = setInterval(checkReminders, 60000);

    return () => clearInterval(interval);
  }, [user?.id, handleNewMessage]);

  return (
    <NotificationContext.Provider
      value={{
        permission,
        unreadCount,
        soundEnabled,
        requestPermission: handleRequestPermission,
        sendTestNotification: async () => {
          const result = await sendTestNotification();
          if ('error' in result) {
            return { ok: false, method: result.method, error: result.error };
          }
          return { ok: true, method: result.method };
        },
        toggleSound,
        refreshUnreadCount,
        showPermissionBanner,
        dismissBanner,
      }}
    >
      {/* Permission Banner - Less intrusive toast-like style on mobile */}
      {showPermissionBanner && (
        <div className="fixed bottom-4 left-4 right-4 md:bottom-auto md:top-0 md:left-0 md:right-0 z-50 bg-card border border-border md:border-0 md:bg-primary md:text-primary-foreground px-3 py-2 md:px-4 md:py-3 flex items-center justify-between shadow-lg rounded-xl md:rounded-none">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Bell className="h-4 w-4 md:h-5 md:w-5 shrink-0 text-primary md:text-primary-foreground" />
            <span className="text-xs md:text-sm font-medium truncate">
              <span className="hidden md:inline">Activa las notificaciones para recibir alertas de mensajes y recordatorios</span>
              <span className="md:hidden">Activar notificaciones</span>
            </span>
          </div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0 ml-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleRequestPermission}
              className="h-8 px-3 text-xs md:text-sm gap-1 md:gap-2"
            >
              <Bell className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Activar</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismissBanner}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className={showPermissionBanner ? 'md:pt-14' : ''}>
        {children}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    // Return safe defaults when used outside provider
    return {
      permission: 'default' as NotificationPermission,
      unreadCount: 0,
      soundEnabled: true,
      requestPermission: async () => 'denied' as NotificationPermission,
      sendTestNotification: async () => ({
        ok: false as const,
        method: 'none',
        error: 'NotificationProvider no está montado',
      }),
      toggleSound: () => {},
      refreshUnreadCount: () => {},
      showPermissionBanner: false,
      dismissBanner: () => {},
    };
  }
  return context;
}
