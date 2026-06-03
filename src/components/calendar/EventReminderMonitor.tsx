import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { toast } from 'sonner';

export function EventReminderMonitor() {
  const { user } = useAuth();
  const notifiedRef = useRef<Set<string>>(new Set());

  // We use the notification context's persistAndNotify indirectly.
  // Since EventReminderMonitor is rendered inside NotificationProvider,
  // we can access the context. But persistAndNotify is not exposed directly,
  // so we use the same pattern: persist to custom_notifications via supabase
  // and let the realtime subscription in useCustomNotifications handle the popup.
  // The browser notification is handled by the shared system.

  const checkUpcomingEvents = useCallback(async () => {
    if (!user) return;
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const { data: events, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('event_date', today)
        .gt('reminder_minutes', 0);

      if (error || !events) return;

      for (const event of events) {
        const key = `${event.id}-${today}`;
        if (notifiedRef.current.has(key)) continue;

        const [hours, minutes] = (event.start_time || '00:00').split(':').map(Number);
        const eventTime = new Date(now);
        eventTime.setHours(hours, minutes, 0, 0);

        const reminderTime = new Date(eventTime.getTime() - (event.reminder_minutes || 15) * 60 * 1000);
        const diff = reminderTime.getTime() - now.getTime();

        // If we're within 60 seconds of the reminder time (or past it but within event time)
        if (diff <= 60000 && diff > -60000) {
          notifiedRef.current.add(key);
          const minutesLeft = Math.round((eventTime.getTime() - now.getTime()) / 60000);
          const message = minutesLeft > 0
            ? `"${event.title}" empieza en ${minutesLeft} minutos`
            : `"${event.title}" empieza ahora`;

          // Show sonner toast (persistent, 15s)
          toast.info(`🔔 Recordatorio: ${event.title}`, { description: message, duration: 15000 });

          // Persist to custom_notifications so it flows through the unified system
          // (browser notification + popup + history)
          await supabase.from('custom_notifications').insert({
            user_id: user.id,
            title: '📅 Recordatorio de evento',
            message: message,
            type: 'warning',
            source: 'calendario',
            icon: '📅',
            is_popup: true,
          });
        }
      }
    } catch (err) {
      console.error('Reminder check error:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Check every 60 seconds
    checkUpcomingEvents();
    const interval = setInterval(checkUpcomingEvents, 60000);
    return () => clearInterval(interval);
  }, [user, checkUpcomingEvents]);

  return null; // This is a background monitor, no UI
}
