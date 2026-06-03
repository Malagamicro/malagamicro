import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGeneralReminders } from './useGeneralReminders';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface BadgeCounts {
  reminders: number;
  inbox: number;
  whatsapp: number;
  osticket: number;
  mensajes: number;
  calendario: number;
  correo: number;
  [key: string]: number;
}

export function useBadgeCounts(): BadgeCounts {
  const { unreadCount, customUnreadCount } = useNotificationContext();
  const { overdueReminders, upcomingReminders } = useGeneralReminders();
  const { user } = useAuth();

  // Count WhatsApp unread chats
  const { data: whatsappUnread = 0 } = useQuery({
    queryKey: ['badge-whatsapp-unread', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase
        .from('whatsapp_chats')
        .select('unread_count')
        .eq('user_id', user.id)
        .gt('unread_count', 0);
      return (data || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Count unread internal chat messages (conversations with unread)
  const { data: chatUnread = 0 } = useQuery({
    queryKey: ['badge-chat-unread', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      // Get conversations where user is participant
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (!participations || participations.length === 0) return 0;

      let count = 0;
      for (const p of participations) {
        const query = supabase
          .from('internal_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', p.conversation_id)
          .neq('sender_id', user.id)
          .eq('is_deleted', false);

        if (p.last_read_at) {
          query.gt('created_at', p.last_read_at);
        }

        const { count: msgCount } = await query;
        count += msgCount || 0;
      }
      return count;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Count recent osTicket tickets (last 24h, unresolved)
  const { data: osticketUnread = 0 } = useQuery({
    queryKey: ['badge-osticket-unread', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('osticket_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('status', 'closed')
        .gte('created_at', oneDayAgo);
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Count unread emails
  const { data: emailUnread = 0 } = useQuery({
    queryKey: ['badge-email-unread', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('email_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('folder', 'inbox')
        .eq('is_read', false);
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  return useMemo(() => {
    const pendingRemindersCount = overdueReminders.length + upcomingReminders.filter(r => {
      const date = new Date(r.reminder_date);
      const now = new Date();
      return (date.getTime() - now.getTime()) < 24 * 60 * 60 * 1000;
    }).length;

    return {
      reminders: pendingRemindersCount,
      inbox: customUnreadCount,
      whatsapp: whatsappUnread,
      osticket: osticketUnread,
      mensajes: chatUnread,
      calendario: 0,
      correo: emailUnread,
    };
  }, [overdueReminders, upcomingReminders, customUnreadCount, whatsappUnread, osticketUnread, chatUnread, emailUnread]);
}
