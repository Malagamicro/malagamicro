import { useState } from 'react';
import { format, isPast, isToday, isThisWeek, addMinutes, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Bell, Check, Clock, Trash2, Plus, Calendar, AlertTriangle,
  CheckCircle2, Eye, Repeat, AlarmClock, Phone, Users2,
  CreditCard, Target, StickyNote, Timer, Pause, Pencil
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const priorityConfig: Record<string, { label: string; gradient: string; border: string; badge: string; dot: string }> = {
  low: { label: 'Baja', gradient: 'from-muted/40 to-muted/20', border: 'border-border', badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  normal: { label: 'Normal', gradient: 'from-secondary/20 to-secondary/5', border: 'border-secondary/30', badge: 'bg-secondary/20 text-secondary-foreground', dot: 'bg-secondary' },
  high: { label: 'Alta', gradient: 'from-orange-500/15 to-orange-500/5', border: 'border-orange-500/30', badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  urgent: { label: 'Urgente', gradient: 'from-destructive/15 to-destructive/5', border: 'border-destructive/40', badge: 'bg-destructive/15 text-destructive', dot: 'bg-destructive' },
};

const categoryIcons: Record<string, React.ReactNode> = {
  general: <Bell className="h-4 w-4" />,
  meeting: <Users2 className="h-4 w-4" />,
  task: <Target className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  deadline: <AlarmClock className="h-4 w-4" />,
  other: <StickyNote className="h-4 w-4" />,
};

const categoryLabels: Record<string, string> = {
  general: 'General', meeting: 'Reunión', task: 'Tarea', call: 'Llamada',
  payment: 'Pago', deadline: 'Fecha límite', other: 'Otro',
};

const recurrenceLabels: Record<string, string> = {
  once: '', daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual',
};

function UrgencyBadge({ reminder }: { reminder: GeneralReminder }) {
  const date = new Date(reminder.reminder_date);
  if (reminder.is_completed) return <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-bold">✅ HECHO</Badge>;
  if (isPast(date)) return <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] font-bold animate-pulse">🔴 VENCIDO</Badge>;
  if (isToday(date)) return <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-0 text-[10px] font-bold">🟡 HOY</Badge>;
  if (isThisWeek(date, { weekStartsOn: 1 })) return <Badge className="bg-accent/15 text-accent border-0 text-[10px] font-bold">🟡 ESTA SEMANA</Badge>;
  return <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-bold">🟢 FUTURO</Badge>;
}

function SnoozeButton({ reminderId, onSnooze }: { reminderId: string; onSnooze: (id: string, min: number) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
          <Pause className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover z-50">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSnooze(reminderId, 15); }}>
          <Timer className="h-3.5 w-3.5 mr-2" /> 15 minutos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSnooze(reminderId, 60); }}>
          <Clock className="h-3.5 w-3.5 mr-2" /> 1 hora
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSnooze(reminderId, 1440); }}>
          <Calendar className="h-3.5 w-3.5 mr-2" /> Mañana
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReminderCard({ reminder, onToggle, onDelete, onView, onSnooze, onEdit }: {
  reminder: GeneralReminder; onToggle: () => void; onDelete: () => void; onView: () => void;
  onSnooze: (id: string, min: number) => void; onEdit: () => void;
}) {
  const reminderDate = new Date(reminder.reminder_date);
  const isOverdue = isPast(reminderDate) && !reminder.is_completed;
  const isTodayR = isToday(reminderDate);
  const prio = priorityConfig[reminder.priority] || priorityConfig.normal;
  const catIcon = categoryIcons[reminder.category || 'general'];

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200',
        'bg-gradient-to-br hover:shadow-md hover:-translate-y-0.5',
        prio.gradient, prio.border,
        reminder.is_completed && 'opacity-50',
        isOverdue && 'ring-1 ring-destructive/30',
        isTodayR && !isOverdue && !reminder.is_completed && 'ring-1 ring-accent/40'
      )}
      onClick={onView}
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <div className={cn('w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-background', prio.dot)} />
        <div className="w-px flex-1 bg-border min-h-[24px]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground flex-shrink-0">{catIcon}</span>
            <h4 className={cn('font-heading text-sm font-semibold tracking-wide truncate', reminder.is_completed && 'line-through text-muted-foreground')}>
              {reminder.title}
            </h4>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <UrgencyBadge reminder={reminder} />
          </div>
        </div>

        {reminder.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{reminder.description}</p>
        )}

        {reminder.note && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 bg-muted/50 rounded-md px-2 py-1">
            <StickyNote className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{reminder.note}</span>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <span className={cn('flex items-center gap-1 text-xs', isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
            {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {format(reminderDate, "d MMM, HH:mm", { locale: es })}
          </span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', prio.badge)}>
            {prio.label}
          </Badge>
          {reminder.recurrence_type && reminder.recurrence_type !== 'once' && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Repeat className="h-3 w-3" /> {recurrenceLabels[reminder.recurrence_type]}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={cn(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
            reminder.is_completed ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'
          )}
        >
          {reminder.is_completed && <Check className="h-3 w-3" />}
        </button>
        {!reminder.is_completed && <SnoozeButton reminderId={reminder.id} onSnooze={onSnooze} />}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ReminderDetailModal({ reminder, open, onOpenChange, onToggle, onDelete, onSnooze }: {
  reminder: GeneralReminder | null; open: boolean; onOpenChange: (open: boolean) => void;
  onToggle: () => void; onDelete: () => void; onSnooze: (id: string, min: number) => void;
}) {
  if (!reminder) return null;
  const reminderDate = new Date(reminder.reminder_date);
  const isOverdue = isPast(reminderDate) && !reminder.is_completed;
  const prio = priorityConfig[reminder.priority] || priorityConfig.normal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-[500px] border-t-4', isOverdue ? 'border-t-destructive' : 'border-t-primary')}>
        <DialogHeader>
          <DialogTitle className="flex items-start gap-3">
            <button onClick={onToggle} className={cn('mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
              reminder.is_completed ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground hover:border-primary')}>
              {reminder.is_completed && <Check className="h-3 w-3" />}
            </button>
            <span className={cn('font-heading', reminder.is_completed && 'line-through text-muted-foreground')}>{reminder.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <UrgencyBadge reminder={reminder} />
            <Badge variant="outline" className={prio.badge}>{prio.label}</Badge>
            <Badge variant="secondary">{categoryLabels[reminder.category || 'general']}</Badge>
            {reminder.recurrence_type !== 'once' && (
              <Badge variant="outline" className="text-xs"><Repeat className="h-3 w-3 mr-1" />{recurrenceLabels[reminder.recurrence_type]}</Badge>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-xs font-heading tracking-widest text-muted-foreground">Fecha y hora</h4>
            <div className={cn('flex items-center gap-2 text-sm', isOverdue && 'text-destructive')}>
              <Calendar className="h-4 w-4" />
              {format(reminderDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> {format(reminderDate, "HH:mm", { locale: es })} hrs
            </div>
          </div>

          {reminder.description && (<><Separator /><div className="space-y-2"><h4 className="text-xs font-heading tracking-widest text-muted-foreground">Descripción</h4><p className="text-sm whitespace-pre-wrap">{reminder.description}</p></div></>)}
          {reminder.note && (<><Separator /><div className="space-y-2"><h4 className="text-xs font-heading tracking-widest text-muted-foreground">Nota</h4><div className="flex items-start gap-2 text-sm bg-muted/50 rounded-lg p-3"><StickyNote className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" /><p>{reminder.note}</p></div></div></>)}

          <Separator />

          <div className="flex flex-wrap gap-2 justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onToggle}>
                {reminder.is_completed ? 'Marcar pendiente' : 'Completar'}
              </Button>
              {!reminder.is_completed && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm"><Pause className="h-3.5 w-3.5 mr-1" /> Snooze</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-popover z-50">
                    <DropdownMenuItem onClick={() => onSnooze(reminder.id, 15)}>15 min</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSnooze(reminder.id, 60)}>1 hora</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSnooze(reminder.id, 1440)}>Mañana</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <Button variant="destructive" size="sm" onClick={() => { onOpenChange(false); onDelete(); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Timeline sidebar for today's reminders ---
function TodayTimeline({ reminders, onView }: { reminders: GeneralReminder[]; onView: (r: GeneralReminder) => void }) {
  const todayReminders = reminders.filter(r => isToday(new Date(r.reminder_date)) && !r.is_completed)
    .sort((a, b) => new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime());

  if (todayReminders.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-heading tracking-widest flex items-center gap-2">
          <AlarmClock className="h-4 w-4 text-accent" /> Hoy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {todayReminders.map((r) => {
          const prio = priorityConfig[r.priority] || priorityConfig.normal;
          return (
            <button key={r.id} onClick={() => onView(r)}
              className="w-full flex items-center gap-3 text-left rounded-lg px-3 py-2 hover:bg-accent/10 transition-colors">
              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', prio.dot)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{r.title}</p>
                <p className="text-[10px] text-muted-foreground">{format(new Date(r.reminder_date), 'HH:mm')}</p>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function GeneralRemindersList() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewReminder, setViewReminder] = useState<GeneralReminder | null>(null);
  const [editReminder, setEditReminder] = useState<GeneralReminder | null>(null);
  const [activeTab, setActiveTab] = useState('pending');

  const {
    pendingReminders, completedReminders, overdueReminders, snoozedReminders,
    isLoading, toggleComplete, deleteReminder, snoozeReminder, reminders
  } = useGeneralReminders();

  const handleDelete = () => { if (deleteId) { deleteReminder(deleteId); setDeleteId(null); } };

  if (isLoading) {
    return (
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Recordatorios</CardTitle></CardHeader>
        <CardContent className="space-y-3">{[1, 2, 3].map((i) => (<Skeleton key={i} className="h-24 w-full rounded-xl" />))}</CardContent></Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main content */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 font-heading tracking-widest">
              <Bell className="h-5 w-5 text-primary" />
              Recordatorios
              {overdueReminders.length > 0 && (
                <Badge className="bg-destructive/15 text-destructive border-0 ml-2 animate-pulse">{overdueReminders.length} vencidos</Badge>
              )}
              {snoozedReminders.length > 0 && (
                <Badge className="bg-muted text-muted-foreground border-0 ml-1"><Pause className="h-3 w-3 mr-1" />{snoozedReminders.length}</Badge>
              )}
            </CardTitle>
            <Button onClick={() => setModalOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Pendientes ({pendingReminders.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Completados ({completedReminders.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-3">
                {pendingReminders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-heading tracking-wider text-sm">Sin recordatorios pendientes</p>
                    <Button variant="outline" className="mt-4" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4 mr-2" /> Crear</Button>
                  </div>
                ) : (
                  pendingReminders.map((reminder) => (
                    <ReminderCard key={reminder.id} reminder={reminder}
                      onToggle={() => { toggleComplete(reminder.id, reminder.is_completed); if (!reminder.is_completed) setTimeout(() => setActiveTab('completed'), 300); }}
                      onDelete={() => setDeleteId(reminder.id)}
                      onView={() => setViewReminder(reminder)}
                      onSnooze={snoozeReminder}
                      onEdit={() => setEditReminder(reminder)}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-3">
                {completedReminders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-heading tracking-wider text-sm">Sin completados</p>
                  </div>
                ) : (
                  completedReminders.map((reminder) => (
                    <ReminderCard key={reminder.id} reminder={reminder}
                      onToggle={() => { toggleComplete(reminder.id, reminder.is_completed); if (reminder.is_completed) setTimeout(() => setActiveTab('pending'), 300); }}
                      onDelete={() => setDeleteId(reminder.id)}
                      onView={() => setViewReminder(reminder)}
                      onSnooze={snoozeReminder}
                      onEdit={() => setEditReminder(reminder)}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Today timeline sidebar */}
        <div className="space-y-4">
          <TodayTimeline reminders={reminders} onView={setViewReminder} />

          {/* Stats mini cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{overdueReminders.length}</p>
                <p className="text-[10px] font-heading tracking-widest text-muted-foreground mt-1">VENCIDOS</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{pendingReminders.length}</p>
                <p className="text-[10px] font-heading tracking-widest text-muted-foreground mt-1">PENDIENTES</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <GeneralReminderModal open={modalOpen || !!editReminder} onOpenChange={(open) => { if (!open) { setModalOpen(false); setEditReminder(null); } }} editReminder={editReminder} />

      <ReminderDetailModal reminder={viewReminder} open={!!viewReminder}
        onOpenChange={(open) => !open && setViewReminder(null)}
        onToggle={() => { if (viewReminder) { toggleComplete(viewReminder.id, viewReminder.is_completed); setViewReminder(null); } }}
        onDelete={() => { if (viewReminder) { setDeleteId(viewReminder.id); setViewReminder(null); } }}
        onSnooze={(id, min) => { snoozeReminder(id, min); setViewReminder(null); }}
        onEdit={() => { if (viewReminder) { setEditReminder(viewReminder); setViewReminder(null); } }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar recordatorio?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
