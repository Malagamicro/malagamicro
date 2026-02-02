import { useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Bell, 
  Check, 
  Clock, 
  Trash2, 
  Plus, 
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Eye,
  X
} from 'lucide-react';
import { useGeneralReminders, GeneralReminder } from '@/hooks/useGeneralReminders';
import { GeneralReminderModal } from './GeneralReminderModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const priorityConfig = {
  low: { label: 'Baja', className: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', className: 'bg-secondary text-secondary-foreground' },
  high: { label: 'Alta', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  urgent: { label: 'Urgente', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const categoryLabels: Record<string, string> = {
  general: 'General',
  meeting: 'Reunión',
  task: 'Tarea',
  call: 'Llamada',
  payment: 'Pago',
  deadline: 'Fecha límite',
  other: 'Otro',
};

function ReminderDetailModal({ 
  reminder, 
  open, 
  onOpenChange,
  onToggle,
  onDelete
}: { 
  reminder: GeneralReminder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  if (!reminder) return null;

  const reminderDate = new Date(reminder.reminder_date);
  const isOverdue = isPast(reminderDate) && !reminder.is_completed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-3">
            <button
              onClick={() => {
                onToggle();
              }}
              className={cn(
                'mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                reminder.is_completed 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : 'border-muted-foreground hover:border-primary'
              )}
            >
              {reminder.is_completed && <Check className="h-3 w-3" />}
            </button>
            <span className={cn(reminder.is_completed && 'line-through text-muted-foreground')}>
              {reminder.title}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={priorityConfig[reminder.priority].className}>
              {priorityConfig[reminder.priority].label}
            </Badge>
            <Badge variant="secondary">
              {categoryLabels[reminder.category || 'general']}
            </Badge>
            {reminder.is_completed && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completado
              </Badge>
            )}
            {isOverdue && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Vencido
              </Badge>
            )}
          </div>

          <Separator />

          {/* Date and time */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Fecha y hora</h4>
            <div className={cn(
              'flex items-center gap-2 text-sm',
              isOverdue && 'text-destructive'
            )}>
              <Calendar className="h-4 w-4" />
              {format(reminderDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {format(reminderDate, "HH:mm", { locale: es })} hrs
            </div>
          </div>

          {/* Description */}
          {reminder.description && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Descripción</h4>
                <p className="text-sm whitespace-pre-wrap">{reminder.description}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Metadata */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Creado: {format(new Date(reminder.created_at), "d MMM yyyy, HH:mm", { locale: es })}</p>
            {reminder.updated_at !== reminder.created_at && (
              <p>Actualizado: {format(new Date(reminder.updated_at), "d MMM yyyy, HH:mm", { locale: es })}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => {
                onToggle();
              }}
            >
              {reminder.is_completed ? 'Marcar pendiente' : 'Marcar completado'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onOpenChange(false);
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReminderItem({ 
  reminder, 
  onToggle, 
  onDelete,
  onView
}: { 
  reminder: GeneralReminder; 
  onToggle: () => void; 
  onDelete: () => void;
  onView: () => void;
}) {
  const reminderDate = new Date(reminder.reminder_date);
  const isOverdue = isPast(reminderDate) && !reminder.is_completed;
  const isTodayReminder = isToday(reminderDate);

  return (
    <div 
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer hover:shadow-sm',
        reminder.is_completed && 'opacity-60 bg-muted/30',
        isOverdue && 'border-destructive/50 bg-destructive/5',
        isTodayReminder && !isOverdue && !reminder.is_completed && 'border-primary/50 bg-primary/5'
      )}
      onClick={onView}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
          reminder.is_completed 
            ? 'bg-primary border-primary text-primary-foreground' 
            : 'border-muted-foreground hover:border-primary'
        )}
      >
        {reminder.is_completed && <Check className="h-3 w-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn(
            'font-medium',
            reminder.is_completed && 'line-through text-muted-foreground'
          )}>
            {reminder.title}
          </h4>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Badge variant="outline" className={priorityConfig[reminder.priority].className}>
              {priorityConfig[reminder.priority].label}
            </Badge>
          </div>
        </div>

        {reminder.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {reminder.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className={cn(
            'flex items-center gap-1',
            isOverdue && 'text-destructive font-medium'
          )}>
            {isOverdue ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            {format(reminderDate, "d 'de' MMMM, HH:mm", { locale: es })}
          </span>
          <Badge variant="secondary" className="text-xs">
            {categoryLabels[reminder.category || 'general']}
          </Badge>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function GeneralRemindersList() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewReminder, setViewReminder] = useState<GeneralReminder | null>(null);
  
  const { 
    pendingReminders, 
    completedReminders, 
    overdueReminders,
    isLoading, 
    toggleComplete, 
    deleteReminder 
  } = useGeneralReminders();

  const handleDelete = () => {
    if (deleteId) {
      deleteReminder(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recordatorios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recordatorios Generales
            {overdueReminders.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {overdueReminders.length} vencidos
              </Badge>
            )}
          </CardTitle>
          <Button onClick={() => setModalOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pendientes ({pendingReminders.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Completados ({completedReminders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-3">
              {pendingReminders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay recordatorios pendientes</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear recordatorio
                  </Button>
                </div>
              ) : (
                pendingReminders.map((reminder) => (
                  <ReminderItem
                    key={reminder.id}
                    reminder={reminder}
                    onToggle={() => toggleComplete(reminder.id, reminder.is_completed)}
                    onDelete={() => setDeleteId(reminder.id)}
                    onView={() => setViewReminder(reminder)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-3">
              {completedReminders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hay recordatorios completados</p>
                </div>
              ) : (
                completedReminders.map((reminder) => (
                  <ReminderItem
                    key={reminder.id}
                    reminder={reminder}
                    onToggle={() => toggleComplete(reminder.id, reminder.is_completed)}
                    onDelete={() => setDeleteId(reminder.id)}
                    onView={() => setViewReminder(reminder)}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <GeneralReminderModal open={modalOpen} onOpenChange={setModalOpen} />

      <ReminderDetailModal
        reminder={viewReminder}
        open={!!viewReminder}
        onOpenChange={(open) => !open && setViewReminder(null)}
        onToggle={() => {
          if (viewReminder) {
            toggleComplete(viewReminder.id, viewReminder.is_completed);
            setViewReminder(null);
          }
        }}
        onDelete={() => {
          if (viewReminder) {
            setDeleteId(viewReminder.id);
            setViewReminder(null);
          }
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar recordatorio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El recordatorio será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
