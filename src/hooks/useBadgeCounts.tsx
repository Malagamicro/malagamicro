import { useMemo } from 'react';
import { useGeneralReminders } from './useGeneralReminders';
import { useNotificationContext } from '@/contexts/NotificationContext';

export interface BadgeCounts {
  reminders: number;
  inbox: number;
  whatsapp: number;
  osticket: number;
  mensajes: number;
  calendario: number;
  [key: string]: number;
}

export function useBadgeCounts(): BadgeCounts {
  const { unreadCount } = useNotificationContext();
  const { overdueReminders, upcomingReminders } = useGeneralReminders();

  return useMemo(() => {
    const pendingRemindersCount = overdueReminders.length + upcomingReminders.filter(r => {
      const date = new Date(r.reminder_date);
      const now = new Date();
      // Show badge for reminders due within the next 24 hours
      return (date.getTime() - now.getTime()) < 24 * 60 * 60 * 1000;
    }).length;

    return {
      reminders: pendingRemindersCount,
      inbox: unreadCount,
      whatsapp: 0,
      osticket: 0,
      mensajes: 0,
      calendario: 0,
    };
  }, [overdueReminders, upcomingReminders, unreadCount]);
}
