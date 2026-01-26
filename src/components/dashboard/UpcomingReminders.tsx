import { forwardRef } from 'react';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, AlertCircle, Clock, Calendar, ArrowRight } from 'lucide-react';
import { useReminders } from '@/hooks/useReminders';
import { cn } from '@/lib/utils';

interface UpcomingRemindersProps {
  onLeadClick?: (leadId: string) => void;
}

export const UpcomingReminders = forwardRef<HTMLDivElement, UpcomingRemindersProps>(
  ({ onLeadClick }, ref) => {
    const { overdueReminders, upcomingReminders, isLoading } = useReminders();

    if (isLoading) {
      return (
        <div ref={ref} className="bg-card rounded-xl p-6 border border-border shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Próximos Recordatorios</h2>
          </div>
          <div className="animate-pulse space-y-3">
            <div className="h-14 bg-muted rounded-lg" />
            <div className="h-14 bg-muted rounded-lg" />
          </div>
        </div>
      );
    }

    const allReminders = [...overdueReminders, ...upcomingReminders].slice(0, 5);

    if (allReminders.length === 0) {
      return (
        <div ref={ref} className="bg-card rounded-xl p-6 border border-border shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Próximos Recordatorios</h2>
          </div>
          <p className="text-muted-foreground text-sm text-center py-6">
            No hay recordatorios pendientes
          </p>
        </div>
      );
    }

    return (
      <div ref={ref} className="bg-card rounded-xl p-6 border border-border shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Próximos Recordatorios</h2>
          {overdueReminders.length > 0 && (
            <span className="ml-auto text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full">
              {overdueReminders.length} vencido{overdueReminders.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="space-y-3">
          {allReminders.map((reminder) => {
            const isOverdue = isPast(reminder.reminderDate);
            const isTodayReminder = isToday(reminder.reminderDate);

            return (
              <button
                key={reminder.id}
                onClick={() => onLeadClick?.(reminder.leadId)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent/50',
                  isOverdue && 'border-destructive/50 bg-destructive/5'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isOverdue ? 'bg-destructive/10' : isTodayReminder ? 'bg-amber-500/10' : 'bg-primary/10'
                    )}
                  >
                    {isOverdue ? (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    ) : isTodayReminder ? (
                      <Clock className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Calendar className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {reminder.lead?.companyName || 'Lead'}
                    </p>
                    <p className={cn('text-xs', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                      {isOverdue
                        ? `Vencido hace ${formatDistanceToNow(reminder.reminderDate, { locale: es })}`
                        : isTodayReminder
                        ? `Hoy a las ${format(reminder.reminderDate, 'HH:mm')}`
                        : format(reminder.reminderDate, "d 'de' MMM", { locale: es })}
                    </p>
                    {reminder.message && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {reminder.message}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);

UpcomingReminders.displayName = 'UpcomingReminders';
