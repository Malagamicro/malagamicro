import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, Check, Trash2, AlertCircle, Clock, Calendar } from 'lucide-react';
import { Reminder, useReminders } from '@/hooks/useReminders';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RemindersListProps {
  leadId: string;
}

export function RemindersList({ leadId }: RemindersListProps) {
  const { reminders, completeReminder, deleteReminder, isLoading } = useReminders(leadId);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Recordatorios</h2>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-muted rounded-lg" />
          <div className="h-16 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  const pendingReminders = reminders.filter(r => !r.isCompleted);
  const completedReminders = reminders.filter(r => r.isCompleted);

  if (reminders.length === 0) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Recordatorios</h2>
        </div>
        <p className="text-muted-foreground text-sm text-center py-4">
          No hay recordatorios programados
        </p>
      </div>
    );
  }

  const getStatusInfo = (reminder: Reminder) => {
    if (reminder.isCompleted) {
      return { icon: Check, color: 'text-green-500', bg: 'bg-green-500/10' };
    }
    if (isPast(reminder.reminderDate)) {
      return { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' };
    }
    if (isToday(reminder.reminderDate)) {
      return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' };
    }
    return { icon: Calendar, color: 'text-primary', bg: 'bg-primary/10' };
  };

  const ReminderItem = ({ reminder }: { reminder: Reminder }) => {
    const status = getStatusInfo(reminder);
    const StatusIcon = status.icon;
    const isOverdue = isPast(reminder.reminderDate) && !reminder.isCompleted;

    return (
      <div
        className={cn(
          'flex items-start gap-3 p-3 rounded-lg border transition-colors',
          reminder.isCompleted && 'opacity-60',
          isOverdue && 'border-destructive/50 bg-destructive/5'
        )}
      >
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', status.bg)}>
          <StatusIcon className={cn('w-4 h-4', status.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium', status.color)}>
              {isToday(reminder.reminderDate)
                ? `Hoy a las ${format(reminder.reminderDate, 'HH:mm')}`
                : format(reminder.reminderDate, "d 'de' MMM 'a las' HH:mm", { locale: es })}
            </span>
            {isOverdue && (
              <span className="text-xs text-destructive">
                (hace {formatDistanceToNow(reminder.reminderDate, { locale: es })})
              </span>
            )}
          </div>
          {reminder.message && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {reminder.message}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {!reminder.isCompleted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
              onClick={() => completeReminder({ id: reminder.id, leadId: reminder.leadId })}
            >
              <Check className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => deleteReminder({ id: reminder.id, leadId: reminder.leadId })}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Recordatorios</h2>
        {pendingReminders.length > 0 && (
          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
            {pendingReminders.length} pendiente{pendingReminders.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {pendingReminders.map((reminder) => (
          <ReminderItem key={reminder.id} reminder={reminder} />
        ))}
        {completedReminders.length > 0 && pendingReminders.length > 0 && (
          <div className="border-t border-border my-3" />
        )}
        {completedReminders.slice(0, 3).map((reminder) => (
          <ReminderItem key={reminder.id} reminder={reminder} />
        ))}
      </div>
    </div>
  );
}
