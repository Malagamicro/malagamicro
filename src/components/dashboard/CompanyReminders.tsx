import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Clock, AlertTriangle } from 'lucide-react';
import { useGeneralReminders } from '@/hooks/useGeneralReminders';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const priorityConfig = {
  urgent: { label: 'Urgente', className: 'bg-destructive text-destructive-foreground' },
  high: { label: 'Alta', className: 'bg-orange-500 text-white' },
  normal: { label: 'Normal', className: 'bg-primary text-primary-foreground' },
  low: { label: 'Baja', className: 'bg-muted text-muted-foreground' },
};

export function CompanyReminders() {
  const { pendingReminders, isLoading } = useGeneralReminders();
  const navigate = useNavigate();

  // Get next 5 pending reminders
  const upcomingReminders = pendingReminders.slice(0, 5);

  const isOverdue = (date: string) => new Date(date) < new Date();

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Recordatorios de Empresa
          </div>
          <button 
            onClick={() => navigate('/reminders')}
            className="text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todos →
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Cargando...</div>
        ) : upcomingReminders.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No hay recordatorios pendientes
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingReminders.map((reminder) => {
              const priority = priorityConfig[reminder.priority];
              const overdue = isOverdue(reminder.reminder_date);
              
              return (
                <div 
                  key={reminder.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate('/reminders')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{reminder.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {overdue ? (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="w-3 h-3" />
                          Vencido
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(reminder.reminder_date), "d MMM, HH:mm", { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={priority.className}>
                    {priority.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
