import { createContext, useContext, useEffect, useCallback, ReactNode, useState, useRef } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useTabNotification } from '@/hooks/useTabNotification';
import { useCustomNotifications, CustomNotification } from '@/hooks/useCustomNotifications';
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
  // Custom notifications (persisted in DB)
  customNotifications: CustomNotification[];
  customUnreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [hasTabNotification, setHasTabNotification] = useState(false);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const persistedIdsRef = useRef<Set<string>>(new Set());

  // Tab notification (red dot on favicon + blinking title)
  useTabNotification(hasTabNotification);

  // Clear tab notification when window gets focus
  useEffect(() => {
    const onFocus = () => setHasTabNotification(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Custom notifications system (persisted DB)
  const {
    notifications: customNotifications,
    unreadCount: customUnreadCount,
    markAsRead,
    markAllAsRead,
    sendNotification: persistNotification,
  } = useCustomNotifications();
  
  const {
    permission,
    unreadCount,
    soundEnabled,
    requestPermission,
    handleNewMessage: rawHandleNewMessage,
    sendTestNotification,
    toggleSound,
    refreshUnreadCount,
  } = useNotifications();

  // Wrap handleNewMessage to also trigger tab notification
  const handleNewMessage = useCallback((title: string, body: string) => {
    if (!document.hasFocus()) {
      setHasTabNotification(true);
    }
    rawHandleNewMessage(title, body);
  }, [rawHandleNewMessage]);

  // Helper: persist a notification to DB AND trigger browser notification
  const persistAndNotify = useCallback(async (params: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error' | 'ai' | 'n8n';
    source: string;
    icon?: string;
    dedupeKey?: string;
  }) => {
    if (!user?.id) return;

    // Deduplicate using a key
    if (params.dedupeKey) {
      if (persistedIdsRef.current.has(params.dedupeKey)) return;
      persistedIdsRef.current.add(params.dedupeKey);
      // Limit the set size to prevent memory leaks
      if (persistedIdsRef.current.size > 500) {
        const entries = Array.from(persistedIdsRef.current);
        persistedIdsRef.current = new Set(entries.slice(-250));
      }
    }

    // 1) Persist to DB
    await persistNotification({
      title: params.title,
      message: params.message,
      type: params.type || 'info',
      source: params.source,
      icon: params.icon,
      isPopup: true,
    });

    // 2) Trigger browser notification + sound + toast
    handleNewMessage(params.title, params.message);
  }, [user?.id, persistNotification, handleNewMessage]);

  // Show permission banner if not granted and not dismissed
  useEffect(() => {
    // Only prompt after login
    if (!user?.id) {
      setShowPermissionBanner(false);
      return;
    }

    if (
      typeof Notification !== 'undefined' &&
      Notification.permission !== 'granted' &&
      !bannerDismissed
    ) {
      setShowPermissionBanner(true);
    } else {
      setShowPermissionBanner(false);
    }
  }, [user?.id, permission, bannerDismissed]);

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

  // ────────────────────────────────────────────────────────────────
  // REALTIME SUBSCRIPTIONS — Each persists to DB + triggers browser notif
  // ────────────────────────────────────────────────────────────────

  // Subscribe to incoming WhatsApp messages
  useEffect(() => {
    if (!user?.id) return;

    let lastNotifiedAt = 0;
    const THROTTLE_MS = 3000;

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
            id: string;
            from_me: boolean; 
            content: string; 
            chat_id: string;
            timestamp: string;
          };
          
          if (msg.from_me) return;

          const msgAge = Date.now() - new Date(msg.timestamp).getTime();
          if (msgAge > 2 * 60 * 1000) return;

          const now = Date.now();
          if (now - lastNotifiedAt < THROTTLE_MS) return;
          lastNotifiedAt = now;

          const { data: chat } = await supabase
            .from('whatsapp_chats')
            .select('custom_name, phone')
            .eq('chat_id', msg.chat_id)
            .maybeSingle();

          const senderName = chat?.custom_name || chat?.phone || 'WhatsApp';

          await persistAndNotify({
            title: `📱 ${senderName}`,
            message: msg.content || 'Mensaje recibido',
            type: 'info',
            source: 'whatsapp',
            icon: '📱',
            dedupeKey: `wa:${msg.id}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, persistAndNotify]);

  // Subscribe to internal chat messages
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
            id: string;
            sender_id: string; 
            content: string | null; 
            conversation_id: string;
            message_type: string;
          };
          
          if (msg.sender_id === user.id) return;

          const { data: participation } = await supabase
            .from('conversation_participants')
            .select('id')
            .eq('conversation_id', msg.conversation_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!participation) return;

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

          await persistAndNotify({
            title: `💬 ${senderName}`,
            message: messagePreview,
            type: 'info',
            source: 'chat-interno',
            icon: '💬',
            dedupeKey: `chat:${msg.id}`,
          });
          
          queryClient.invalidateQueries({ queryKey: ['internal-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, persistAndNotify, queryClient]);

  // Subscribe to osTicket tickets
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`osticket-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'osticket_tickets',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const ticket = payload.new as {
            id: string;
            subject: string;
            message: string | null;
            ticket_number: string | null;
          };

          await persistAndNotify({
            title: '🎫 Nuevo ticket',
            message: ticket.subject || ticket.message || 'Ticket recibido',
            type: 'warning',
            source: 'osticket',
            icon: '🎫',
            dedupeKey: `ticket:${ticket.id}`,
          });

          queryClient.invalidateQueries({ queryKey: ['osticket-tickets'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, persistAndNotify, queryClient]);

  // Subscribe to incoming emails (IMAP synced)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`email-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_messages',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const email = payload.new as {
            id: string;
            from_address: string | null;
            from_name: string | null;
            subject: string | null;
            folder: string;
          };

          // Only notify for inbox emails
          if (email.folder !== 'inbox') return;

          const sender = email.from_name || email.from_address || 'Desconocido';

          await persistAndNotify({
            title: `📧 ${sender}`,
            message: email.subject || 'Nuevo email recibido',
            type: 'info',
            source: 'email',
            icon: '📧',
            dedupeKey: `email:${email.id}`,
          });

          queryClient.invalidateQueries({ queryKey: ['email-messages'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, persistAndNotify, queryClient]);

  // Subscribe to calendar events created by other users that involve this user
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`calendar-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calendar_events',
        },
        async (payload) => {
          const event = payload.new as {
            id: string;
            title: string;
            event_date: string;
            start_time: string | null;
            creator_id: string | null;
          };

          // Don't notify for own events
          if (event.creator_id === user.id) return;

          // Check if this user is a participant
          const { data: participant } = await supabase
            .from('event_participants')
            .select('id')
            .eq('event_id', event.id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!participant) return;

          await persistAndNotify({
            title: '📅 Nuevo evento',
            message: `"${event.title}" - ${event.event_date}${event.start_time ? ` a las ${event.start_time.slice(0, 5)}` : ''}`,
            type: 'info',
            source: 'calendario',
            icon: '📅',
            dedupeKey: `cal:${event.id}`,
          });

          queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, persistAndNotify, queryClient]);

  // Subscribe to lead status changes (for admin notification)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`lead-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const oldLead = payload.old as { status?: string };
          const newLead = payload.new as { id: string; company_name?: string; status?: string };

          // Only notify if status changed
          if (!oldLead?.status || oldLead.status === newLead.status) return;

          await persistAndNotify({
            title: '📊 Lead actualizado',
            message: `"${newLead.company_name || 'Lead'}" cambió de ${oldLead.status} a ${newLead.status}`,
            type: 'info',
            source: 'leads',
            icon: '📊',
            dedupeKey: `lead:${newLead.id}:${newLead.status}`,
          });

          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, persistAndNotify, queryClient]);

  // Check for due reminders every minute
  useEffect(() => {
    if (!user?.id) return;

    const checkReminders = async () => {
      const now = new Date();
      const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

      // 1) Lead follow-ups
      const { data: dueReminders } = await supabase
        .from('follow_up_reminders')
        .select('id, message, reminder_date, leads(company_name)')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .gte('reminder_date', now.toISOString())
        .lte('reminder_date', fiveMinutesLater.toISOString());

      if (dueReminders && dueReminders.length > 0) {
        for (const reminder of dueReminders) {
          const key = `follow:${reminder.id}`;
          if (notifiedIdsRef.current.has(key)) continue;
          notifiedIdsRef.current.add(key);

          const lead = reminder.leads as { company_name?: string } | null;
          const body = reminder.message || `Seguimiento: ${lead?.company_name || 'Lead'}`;

          await persistAndNotify({
            title: '⏰ Recordatorio',
            message: body,
            type: 'warning',
            source: 'recordatorio',
            icon: '⏰',
            dedupeKey: key,
          });
        }
      }

      // 2) General/company reminders
      const { data: dueGeneral } = await supabase
        .from('general_reminders')
        .select('id, title, description, reminder_date, priority')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .gte('reminder_date', now.toISOString())
        .lte('reminder_date', fiveMinutesLater.toISOString());

      if (dueGeneral && dueGeneral.length > 0) {
        for (const reminder of dueGeneral) {
          const key = `general:${reminder.id}`;
          if (notifiedIdsRef.current.has(key)) continue;
          notifiedIdsRef.current.add(key);

          const body = reminder.title || reminder.description || 'Tarea pendiente';

          await persistAndNotify({
            title: '📌 Recordatorio',
            message: body,
            type: 'warning',
            source: 'recordatorio',
            icon: '📌',
            dedupeKey: key,
          });
        }
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000);

    return () => clearInterval(interval);
  }, [user?.id, persistAndNotify]);

  // Total unread = whatsapp unread + custom notifications unread
  const totalUnreadCount = unreadCount + customUnreadCount;

  return (
    <NotificationContext.Provider
      value={{
        permission,
        unreadCount: totalUnreadCount,
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
        // Custom notifications
        customNotifications,
        customUnreadCount,
        markAsRead,
        markAllAsRead,
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
      customNotifications: [] as CustomNotification[],
      customUnreadCount: 0,
      markAsRead: () => {},
      markAllAsRead: () => {},
    };
  }
  return context;
}
