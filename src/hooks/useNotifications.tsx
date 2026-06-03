import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface NotificationState {
  permission: NotificationPermission;
  unreadCount: number;
  soundEnabled: boolean;
}

type NotificationDeliveryMethod = 'serviceWorker' | 'constructor' | 'none';
export type NotificationAttemptResult =
  | { ok: true; method: Exclude<NotificationDeliveryMethod, 'none'> }
  | { ok: false; method: NotificationDeliveryMethod; error: string };

function getRuntimePermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
}

function formatNotifyError(err: unknown): string {
  if (err instanceof Error) {
    return err.name ? `${err.name}: ${err.message}` : err.message;
  }
  try {
    return typeof err === 'string' ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Generate a simple pop sound using Web Audio API (fallback)
function createSynthPopSound(): () => void {
  return () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.12);
    } catch (err) {
      console.warn('Could not play notification sound:', err);
    }
  };
}

function createMp3PopSound(): () => boolean {
  const audio = new Audio('/pop.mp3');
  audio.preload = 'auto';
  audio.volume = 0.35;
  let available = true;

  audio.addEventListener('error', () => {
    available = false;
  });

  return () => {
    if (!available) return false;
    try {
      audio.currentTime = 0;
      audio.play().catch((err) => {
        available = false;
        console.warn('Could not play /pop.mp3:', err);
      });
      return true;
    } catch (err) {
      available = false;
      console.warn('Could not play /pop.mp3:', err);
      return false;
    }
  };
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const playSoundRef = useRef<(() => void) | null>(null);
  const lastDeniedToastAtRef = useRef<number>(0);
  const lastNotificationErrorToastAtRef = useRef<number>(0);
  const lastForegroundToastAtRef = useRef<number>(0);
  const originalTitleRef = useRef(document.title);
  const [state, setState] = useState<NotificationState>({
    permission: getRuntimePermission(),
    unreadCount: 0,
    soundEnabled: true,
  });

  // Keep permission in sync (user can change it from browser UI without reloading)
  useEffect(() => {
    const syncPermission = () => {
      const perm = getRuntimePermission();
      setState((prev) => (prev.permission === perm ? prev : { ...prev, permission: perm }));
    };

    let status: PermissionStatus | null = null;
    let cancelled = false;

    const setup = async () => {
      syncPermission();
      window.addEventListener('focus', syncPermission);
      document.addEventListener('visibilitychange', syncPermission);

      // Last-resort polling (some browsers won't emit any event when toggling permission via the URL lock)
      const interval = window.setInterval(syncPermission, 2000);

      // Best-effort: live updates via Permissions API (more reliable than focus/visibility)
      try {
        if (navigator.permissions?.query) {
          status = await navigator.permissions.query({ name: 'notifications' as PermissionName });
          if (cancelled) return;
          status.onchange = () => syncPermission();
        }
      } catch (err) {
        // Not supported on some browsers (e.g. iOS Safari)
        console.debug('Permissions API not available for notifications:', err);
      }

      return () => window.clearInterval(interval);
    };

    const teardownPromise = setup();

    return () => {
      cancelled = true;
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
      if (status) status.onchange = null;

      // If setup created an interval, clear it
      Promise.resolve(teardownPromise)
        .then((teardown) => {
          if (typeof teardown === 'function') teardown();
        })
        .catch(() => {
          // ignore
        });
    };
  }, []);

  // Initialize sound function
  useEffect(() => {
    // Prefer /pop.mp3 if present, fallback to synthesized pop.
    const mp3 = createMp3PopSound();
    const synth = createSynthPopSound();
    playSoundRef.current = () => {
      const ok = mp3();
      if (!ok) synth();
    };
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
    if (getRuntimePermission() !== 'granted') return null;

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
      console.error('Error showing notification (constructor):', error);
      return null;
    }
  }, []);

  const showNotificationSmart = useCallback(
    async (
      title: string,
      body: string,
      options?: NotificationOptions,
      config?: { notifyOnError?: boolean },
    ): Promise<NotificationAttemptResult> => {
      const perm = getRuntimePermission();
      if (perm !== 'granted') {
        return { ok: false, method: 'none', error: `Notification.permission = ${perm}` };
      }

      const notifOptions: NotificationOptions = {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `message-${Date.now()}`,
        requireInteraction: false,
        ...options,
      };

      // 1) Prefer Service Worker (more reliable in PWA contexts)
      let swError: string | null = null;
      try {
        if ('serviceWorker' in navigator) {
          // If a SW is controlling the page, ready resolves immediately and gives the right registration.
          const reg = navigator.serviceWorker.controller
            ? await navigator.serviceWorker.ready
            : await navigator.serviceWorker.getRegistration();
          if (reg && typeof reg.showNotification === 'function') {
            await reg.showNotification(title, notifOptions);
            return { ok: true, method: 'serviceWorker' };
          }
          swError = 'Service Worker missing';
        } else {
          swError = 'Service Worker missing';
        }
      } catch (err) {
        swError = formatNotifyError(err);
      }

      // 2) Fallback to constructor
      try {
        const notification = new Notification(title, notifOptions);

        setTimeout(() => notification.close(), 5000);
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return { ok: true, method: 'constructor' };
      } catch (err) {
        const ctorError = formatNotifyError(err);
        const errorText = swError ? `SW: ${swError} | Notification(): ${ctorError}` : ctorError;

        console.error('Error showing notification:', { swError, ctorError });

        if (config?.notifyOnError) {
          const now = Date.now();
          if (now - lastNotificationErrorToastAtRef.current > 30000) {
            lastNotificationErrorToastAtRef.current = now;
            toast({
              title: 'Error al mostrar notificación',
              description: errorText,
            });
          }
        }

        return { ok: false, method: 'constructor', error: errorText };
      }
    },
    [],
  );

  // Handle new incoming message — ALWAYS show notification (browser + in-app)
  const handleNewMessage = useCallback((senderName: string, messageContent: string) => {
    const perm = getRuntimePermission();

    // If blocked, show a diagnostic toast (throttled)
    if (perm === 'denied') {
      const now = Date.now();
      if (now - lastDeniedToastAtRef.current > 15000) {
        lastDeniedToastAtRef.current = now;
        toast({
          title: '⚠️ Notificaciones bloqueadas',
          description: 'Tienes las notificaciones bloqueadas en el navegador. Pulsa en el candado de la URL para permitirlas.',
        });
      }
      // Still play sound (if user has interacted)
      playSound();
      return;
    }

    const preview = messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent;

    // ALWAYS show browser notification (native OS) regardless of tab visibility
    void showNotificationSmart(senderName, preview, undefined, { notifyOnError: false }).then((result) => {
      // Visual notification failed for any reason -> sound fallback
      if (!result.ok) playSound();
    });

    // ALWAYS show in-app toast as well (throttled to avoid spam)
    const now = Date.now();
    if (now - lastForegroundToastAtRef.current > 1500) {
      lastForegroundToastAtRef.current = now;
      toast({
        title: senderName,
        description: preview,
      });
    }

    // Always play sound
    playSound();

    // Invalidate unread count
    queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
  }, [playSound, queryClient, showNotificationSmart]);

  const sendTestNotification = useCallback(async (): Promise<NotificationAttemptResult> => {
    const result = await showNotificationSmart('Prueba', 'Si lees esto, funcionan ✅', undefined, {
      notifyOnError: true,
    });

    // If visual notification fails, ensure we still alert with sound
    if (!result.ok) {
      playSound();
    }

    return result;
  }, [playSound, showNotificationSmart]);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setState(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  // Refresh unread count
  const refreshUnreadCount = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
  }, [queryClient]);

  return {
    // Always expose the real runtime permission (not just local state)
    permission: getRuntimePermission(),
    unreadCount: state.unreadCount,
    soundEnabled: state.soundEnabled,
    requestPermission,
    showNotification,
    playSound,
    handleNewMessage,
    sendTestNotification,
    toggleSound,
    refreshUnreadCount,
    isLoading: unreadQuery.isLoading,
  };
}
