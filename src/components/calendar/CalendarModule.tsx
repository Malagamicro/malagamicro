import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, Users, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useCalendarEvents, CalendarEvent, CreateEventData } from '@/hooks/useCalendarEvents';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';

const COLOR_OPTIONS = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#f59e0b', label: 'Naranja' },
  { value: '#8b5cf6', label: 'Morado' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#14b8a6', label: 'Teal' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: 'Sin recordatorio' },
  { value: 5, label: '5 minutos antes' },
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 día antes' },
];

export function CalendarModule() {
  const { user } = useAuth();
  const { events, isLoading, users, createEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    event_date: string;
    start_time: string;
    end_time: string;
    all_day: boolean;
    color: string;
    reminder_minutes: number;
    selectedUsers: { user_id: string; permission: 'view' | 'edit' }[];
  }>({
    title: '',
    description: '',
    event_date: '',
    start_time: '09:00',
    end_time: '10:00',
    all_day: false,
    color: '#3b82f6',
    reminder_minutes: 15,
    selectedUsers: [],
  });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getEventsForDay = (day: Date) => {
    return events.filter(e => isSameDay(parseISO(e.event_date), day));
  };

  const openNewEvent = (date?: Date) => {
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      event_date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '10:00',
      all_day: false,
      color: '#3b82f6',
      reminder_minutes: 15,
      selectedUsers: [],
    });
    setShowForm(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      start_time: event.start_time?.substring(0, 5) || '09:00',
      end_time: event.end_time?.substring(0, 5) || '10:00',
      all_day: event.all_day,
      color: event.color,
      reminder_minutes: event.reminder_minutes,
      selectedUsers: [],
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;
    const data: CreateEventData = {
      title: formData.title,
      description: formData.description || undefined,
      event_date: formData.event_date,
      start_time: formData.start_time,
      end_time: formData.end_time || undefined,
      all_day: formData.all_day,
      color: formData.color,
      reminder_minutes: formData.reminder_minutes,
      participants: formData.selectedUsers,
    };

    if (editingEvent) {
      await updateEvent(editingEvent.id, data);
    } else {
      await createEvent(data);
    }
    setShowForm(false);
  };

  const toggleUserSelection = (userId: string) => {
    setFormData(prev => {
      const exists = prev.selectedUsers.find(u => u.user_id === userId);
      if (exists) {
        return { ...prev, selectedUsers: prev.selectedUsers.filter(u => u.user_id !== userId) };
      }
      return { ...prev, selectedUsers: [...prev.selectedUsers, { user_id: userId, permission: 'view' as const }] };
    });
  };

  const updateUserPermission = (userId: string, permission: 'view' | 'edit') => {
    setFormData(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.map(u =>
        u.user_id === userId ? { ...u, permission } : u
      ),
    }));
  };

  const dayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  return (
    <div className="p-3 sm:p-8 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground">Calendario</h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-1">
            Eventos compartidos del equipo
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'month' ? 'week' : 'month')}>
            {viewMode === 'month' ? 'Semanal' : 'Mensual'}
          </Button>
          <Button size="sm" onClick={() => openNewEvent()}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo evento
          </Button>
        </div>
      </div>

      {/* Calendar header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayEvts = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  onDoubleClick={() => openNewEvent(day)}
                  className={cn(
                    'relative min-h-[60px] sm:min-h-[80px] p-1 rounded-lg border text-left transition-colors',
                    isCurrentMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground',
                    isToday && 'ring-2 ring-primary',
                    isSelected && 'bg-accent',
                    'hover:bg-accent/50'
                  )}
                >
                  <span className={cn(
                    'text-xs font-medium',
                    isToday && 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvts.slice(0, 2).map(evt => (
                      <div
                        key={evt.id}
                        className="text-[10px] truncate rounded px-1 py-0.5 text-white font-medium cursor-pointer"
                        style={{ backgroundColor: evt.color }}
                        onClick={(e) => { e.stopPropagation(); openEditEvent(evt); }}
                      >
                        {evt.title}
                      </div>
                    ))}
                    {dayEvts.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{dayEvts.length - 2} más</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day events */}
      {selectedDate && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
              </h3>
              <Button size="sm" variant="outline" onClick={() => openNewEvent(selectedDate)}>
                <Plus className="w-4 h-4 mr-1" /> Añadir
              </Button>
            </div>
            {dayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin eventos para este día</p>
            ) : (
              <div className="space-y-2">
                {dayEvents.map(evt => (
                  <div
                    key={evt.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => openEditEvent(evt)}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: evt.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{evt.title}</p>
                      {!evt.all_day && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {evt.start_time?.substring(0, 5)}{evt.end_time && ` - ${evt.end_time.substring(0, 5)}`}
                        </p>
                      )}
                      {evt.all_day && <Badge variant="secondary" className="text-[10px]">Todo el día</Badge>}
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="shrink-0" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (window.confirm('¿Eliminar este evento?')) {
                          deleteEvent(evt.id); 
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Event form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4 pb-2">
              <div>
                <Label>Título *</Label>
                <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Título del evento" />
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Información adicional" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fecha *</Label>
                  <Input type="date" value={formData.event_date} onChange={e => setFormData(p => ({ ...p, event_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="flex gap-1.5 mt-1">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c.value}
                        className={cn('w-7 h-7 rounded-full transition-all', formData.color === c.value && 'ring-2 ring-offset-2 ring-primary')}
                        style={{ backgroundColor: c.value }}
                        onClick={() => setFormData(p => ({ ...p, color: c.value }))}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.all_day} onCheckedChange={v => setFormData(p => ({ ...p, all_day: v }))} />
                <Label>Todo el día</Label>
              </div>
              {!formData.all_day && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Hora inicio</Label>
                    <Input type="time" value={formData.start_time} onChange={e => setFormData(p => ({ ...p, start_time: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Hora fin</Label>
                    <Input type="time" value={formData.end_time} onChange={e => setFormData(p => ({ ...p, end_time: e.target.value }))} />
                  </div>
                </div>
              )}
              <div>
                <Label>Recordatorio</Label>
                <Select value={String(formData.reminder_minutes)} onValueChange={v => setFormData(p => ({ ...p, reminder_minutes: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.map(r => (
                      <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* User multiselect */}
              <div>
                <Label className="flex items-center gap-1"><Users className="w-4 h-4" /> Compartir con</Label>
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-1">No hay otros usuarios</p>
                ) : (
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                    {users.map(u => {
                      const selected = formData.selectedUsers.find(s => s.user_id === u.id);
                      return (
                        <div key={u.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={!!selected}
                            onCheckedChange={() => toggleUserSelection(u.id)}
                          />
                          <span className="text-sm flex-1 truncate">{u.full_name || u.email}</span>
                          {selected && (
                            <Select value={selected.permission} onValueChange={(v: 'view' | 'edit') => updateUserPermission(u.id, v)}>
                              <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="view">Solo ver</SelectItem>
                                <SelectItem value="edit">Editar</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={handleSubmit} disabled={!formData.title.trim()}>
                  {editingEvent ? 'Guardar cambios' : 'Crear evento'}
                </Button>
                {editingEvent && (
                  <Button variant="destructive" onClick={() => { 
                    if (window.confirm('¿Eliminar este evento?')) {
                      deleteEvent(editingEvent.id); 
                      setShowForm(false); 
                    }
                  }}>
                    <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
