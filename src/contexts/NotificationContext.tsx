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
        toggleSound,
        refreshUnreadCount,
        showPermissionBanner,
        dismissBanner,
      }}
    >
      {/* Permission Banner */}
      {showPermissionBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5" />
            <span className="text-sm font-medium">
              Activa las notificaciones para recibir alertas de mensajes y recordatorios
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRequestPermission}
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              🔔 Activar Notificaciones
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={dismissBanner}
              className="h-8 w-8 p-0 hover:bg-primary-foreground/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className={showPermissionBanner ? 'pt-14' : ''}>
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
      toggleSound: () => {},
      refreshUnreadCount: () => {},
      showPermissionBanner: false,
      dismissBanner: () => {},
    };
  }
  return context;
}
