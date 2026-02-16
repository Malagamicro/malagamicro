import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Sound alert using Web Audio API
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.3);
    }, 350);
  } catch (e) {
    console.warn('Could not play alert sound:', e);
  }
}

function showBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.png' });
  }
}

export function EventReminderMonitor() {
  const { user } = useAuth();
  const notifiedRef = useRef<Set<string>>(new Set());

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

          toast.info(`🔔 Recordatorio: ${event.title}`, { description: message, duration: 15000 });
          playAlertSound();
          showBrowserNotification('📅 Recordatorio', message);
        }
      }
    } catch (err) {
      console.error('Reminder check error:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Check every 60 seconds
    checkUpcomingEvents();
    const interval = setInterval(checkUpcomingEvents, 60000);
    return () => clearInterval(interval);
  }, [user, checkUpcomingEvents]);

  return null; // This is a background monitor, no UI
}
