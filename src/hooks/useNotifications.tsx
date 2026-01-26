import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface NotificationState {
  permission: NotificationPermission;
  unreadCount: number;
  soundEnabled: boolean;
}

// Generate a simple pop sound using Web Audio API
function createPopSound(): () => void {
  return () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (err) {
      console.warn('Could not play notification sound:', err);
    }
  };
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const playSoundRef = useRef<(() => void) | null>(null);
  const originalTitleRef = useRef(document.title);
  const [state, setState] = useState<NotificationState>({
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'denied',
    unreadCount: 0,
    soundEnabled: true,
  });

  // Initialize sound function
  useEffect(() => {
    playSoundRef.current = createPopSound();
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      console.warn('Notifications not supported');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, []);

  // Query unread count from database
  const unreadQuery = useQuery({
    queryKey: ['unread-messages-count'],
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;

      // Count messages where from_me = false (incoming) 
      // and the chat has unread_count > 0
      const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('unread_count')
        .eq('user_id', user.id)
        .gt('unread_count', 0);

      if (error) throw error;

      // Sum all unread counts
      const total = (data || []).reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
      return total;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30s as backup
  });

  // Update state when query changes
  useEffect(() => {
    if (unreadQuery.data !== undefined) {
      setState(prev => ({ ...prev, unreadCount: unreadQuery.data }));
    }
  }, [unreadQuery.data]);

  // Update document title based on unread count
  useEffect(() => {
    const count = state.unreadCount;
    
    if (count > 0) {
      document.title = `(${count}) Inbox - MalagaMicro CRM`;
    } else {
      document.title = originalTitleRef.current;
    }

    return () => {
      document.title = originalTitleRef.current;
    };
  }, [state.unreadCount]);

  // Play notification sound
  const playSound = useCallback(() => {
    if (state.soundEnabled && playSoundRef.current) {
      playSoundRef.current();
    }
  }, [state.soundEnabled]);

  // Show browser notification
  const showNotification = useCallback((title: string, body: string, options?: NotificationOptions) => {
    if (state.permission !== 'granted') {
      console.log('Notification permission not granted, requesting...');
      // Try to request permission
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      return null;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `message-${Date.now()}`, // Unique tag for each notification
        requireInteraction: false,
        ...options,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Focus window on click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }, [state.permission]);

  // Handle new incoming message
  const handleNewMessage = useCallback((senderName: string, messageContent: string) => {
    // Play sound always
    playSound();

    // Show browser notification (removed document.hidden check to always notify)
    showNotification(
      senderName,
      messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent
    );

    // Invalidate unread count
    queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
  }, [playSound, showNotification, queryClient]);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setState(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  // Refresh unread count
  const refreshUnreadCount = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
  }, [queryClient]);

  return {
    permission: state.permission,
    unreadCount: state.unreadCount,
    soundEnabled: state.soundEnabled,
    requestPermission,
    showNotification,
    playSound,
    handleNewMessage,
    toggleSound,
    refreshUnreadCount,
    isLoading: unreadQuery.isLoading,
  };
}
