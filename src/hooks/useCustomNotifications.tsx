import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

export interface CustomNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'ai' | 'n8n';
  source: string;
  icon?: string;
  color?: string;
  action_url?: string;
  action_label?: string;
  is_read: boolean;
  is_popup: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  expires_at?: string;
}

export function useCustomNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CustomNotification[]>([]);
  const [popupQueue, setPopupQueue] = useState<CustomNotification[]>([]);
  const queryClient = useQueryClient();

  // Load unread notifications
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('custom_notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      setNotifications(data as unknown as CustomNotification[]);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`custom-notifs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'custom_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new as unknown as CustomNotification;
          setNotifications(prev => [notif, ...prev]);
          
          // If it's a popup notification, add to queue
          if (notif.is_popup) {
            setPopupQueue(prev => [...prev, notif]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from('custom_notifications')
      .update({ is_read: true })
      .eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('custom_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications([]);
  }, [user]);

  const dismissPopup = useCallback((id: string) => {
    setPopupQueue(prev => prev.filter(n => n.id !== id));
    markAsRead(id);
  }, [markAsRead]);

  const sendNotification = useCallback(async (params: {
    targetUserId?: string;
    title: string;
    message: string;
    type?: string;
    source?: string;
    icon?: string;
    color?: string;
    actionUrl?: string;
    actionLabel?: string;
    isPopup?: boolean;
    metadata?: Record<string, unknown>;
  }) => {
    const targetId = params.targetUserId || user?.id;
    if (!targetId) return;

    const { error } = await supabase
      .from('custom_notifications')
      .insert({
        user_id: targetId,
        title: params.title,
        message: params.message,
        type: params.type || 'info',
        source: params.source || 'manual',
        icon: params.icon,
        color: params.color,
        action_url: params.actionUrl,
        action_label: params.actionLabel,
        is_popup: params.isPopup || false,
        metadata: params.metadata as any,
      });

    if (error) console.error('Error sending notification:', error);
  }, [user]);

  return {
    notifications,
    popupQueue,
    unreadCount: notifications.length,
    markAsRead,
    markAllAsRead,
    dismissPopup,
    sendNotification,
    refresh: loadNotifications,
  };
}
