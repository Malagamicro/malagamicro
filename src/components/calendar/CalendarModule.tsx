import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, parseISO,
  startOfDay, endOfDay,
  isToday as isDateToday, addDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Clock, Trash2,
  CalendarDays, CalendarRange, CalendarCheck2, Search, Filter, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCalendarEvents, CalendarEvent, CreateEventData } from '@/hooks/useCalendarEvents';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { COLOR_OPTIONS, HOURS } from './CalendarConstants';
import { EventDetailDialog, EventFormDialog, EventFormData } from './CalendarDialogs';

export function CalendarModule() {
  const { user } = useAuth();
  const { events, isLoading, users, createEvent, updateEvent, deleteEvent, fetchEventParticipants } = useCalendarEvents();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showEventDetail, setShowEventDetail] = useState<CalendarEvent | null>(null);

  // Quick-add sidebar form state
  const [quickAdd, setQuickAdd] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '10:00',
    all_day: false,
    color: '#3b82f6',
  });
  const [quickAdding, setQuickAdding] = useState(false);

  // Form state
  const [formData, setFormData] = useState<EventFormData>({
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

  // Sync quick-add date when a day is selected in the calendar
  useEffect(() => {
    if (selectedDate) {
      setQuickAdd(prev => ({ ...prev, date: format(selectedDate, 'yyyy-MM-dd') }));
    }
  }, [selectedDate]);

  // Calendar days for month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Week days for week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const filteredEvents = useMemo(() => {
    let filtered = events;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(lower) ||
        e.description?.toLowerCase().includes(lower)
      );
    }
    if (filterColor) {
      filtered = filtered.filter(e => e.color === filterColor);
    }
    return filtered;
  }, [events, searchTerm, filterColor]);

  const getEventsForDay = useCallback((day: Date) => {
    return filteredEvents.filter(e => isSameDay(parseISO(e.event_date), day));
  }, [filteredEvents]);

  const navigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const openNewEvent = (date?: Date, startHour?: number) => {
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      event_date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      start_time: startHour !== undefined ? `${String(startHour).padStart(2, '0')}:00` : '09:00',
      end_time: startHour !== undefined ? `${String(startHour + 1).padStart(2, '0')}:00` : '10:00',
      all_day: false,
      color: '#3b82f6',
      reminder_minutes: 15,
      selectedUsers: [],
    });
    setShowForm(true);
  };

  const openEditEvent = async (event: CalendarEvent) => {
    setEditingEvent(event);
    // Load existing participants
    const participants = await fetchEventParticipants(event.id);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      start_time: event.start_time?.substring(0, 5) || '09:00',
      end_time: event.end_time?.substring(0, 5) || '10:00',
      all_day: event.all_day,
      color: event.color,
      reminder_minutes: event.reminder_minutes,
      selectedUsers: participants,
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

  const handleDeleteEvent = async (eventId: string) => {
    await deleteEvent(eventId);
    setShowDeleteConfirm(null);
    setShowForm(false);
    setShowEventDetail(null);
  };

  const handleQuickAdd = async () => {
    if (!quickAdd.title.trim()) return;
    setQuickAdding(true);
    try {
      await createEvent({
        title: quickAdd.title.trim(),
        event_date: quickAdd.date,
        start_time: quickAdd.all_day ? undefined : quickAdd.start_time,
        end_time: quickAdd.all_day ? undefined : quickAdd.end_time,
        all_day: quickAdd.all_day,
        color: quickAdd.color,
        reminder_minutes: 15,
        participants: [],
      });
      setQuickAdd(prev => ({ ...prev, title: '' }));
    } finally {
      setQuickAdding(false);
    }
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

  const headerLabel = viewMode === 'month'
    ? format(currentDate, 'MMMM yyyy', { locale: es })
    : `${format(weekDays[0], "d MMM", { locale: es })} — ${format(weekDays[6], "d MMM yyyy", { locale: es })}`;

  // Upcoming events (next 7 days)
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    const next7 = addDays(today, 7);
    return filteredEvents
      .filter(e => {
        const d = parseISO(e.event_date);
        return d >= startOfDay(today) && d <= endOfDay(next7);
      })
      .sort((a, b) => {
        const da = parseISO(a.event_date).getTime();
        const db = parseISO(b.event_date).getTime();
        if (da !== db) return da - db;
        return (a.start_time || '').localeCompare(b.start_time || '');
      })
      .slice(0, 5);
  }, [filteredEvents]);

  const getEventTopAndHeight = (event: CalendarEvent) => {
    const startParts = (event.start_time || '09:00').substring(0, 5).split(':');
    const endParts = (event.end_time || event.start_time || '10:00').substring(0, 5).split(':');
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    const baseMinutes = 7 * 60; // 7:00
    const top = ((startMinutes - baseMinutes) / 60) * 64; // 64px per hour
    const height = Math.max(((endMinutes - startMinutes) / 60) * 64, 24);
    return { top, height };
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Calendario</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Eventos compartidos del equipo</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar evento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 w-40 text-sm"
            />
          </div>

          {/* Color filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(filterColor && 'ring-2 ring-primary')}>
                <Filter className="w-3.5 h-3.5 mr-1" />
                Filtrar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="end">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Filtrar por color</p>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  className={cn('w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center text-xs',
                    !filterColor ? 'border-primary bg-accent' : 'border-transparent')}
                  onClick={() => setFilterColor(null)}
                >
                  ✕
                </button>
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    className={cn('w-7 h-7 rounded-full transition-all',
                      filterColor === c.value && 'ring-2 ring-offset-2 ring-primary')}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setFilterColor(filterColor === c.value ? null : c.value)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* View toggle */}
          <TooltipProvider>
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'month' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setViewMode('month')}
                  >
                    <CalendarDays className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vista mensual</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setViewMode('week')}
                  >
                    <CalendarRange className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vista semanal</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <Button size="sm" onClick={() => openNewEvent(selectedDate || undefined)}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main calendar area */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-3 sm:p-4">
              {/* Navigation */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('prev')}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('next')}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <h2 className="text-base sm:text-lg font-semibold capitalize">{headerLabel}</h2>
                </div>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  <CalendarCheck2 className="w-3.5 h-3.5 mr-1" /> Hoy
                </Button>
              </div>

              {/* Month View */}
              {viewMode === 'month' && (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                      <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day) => {
                      const dayEvts = getEventsForDay(day);
                      const isToday = isDateToday(day);
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isCurrentMonth = isSameMonth(day, currentDate);

                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(day)}
                          onDoubleClick={() => openNewEvent(day)}
                          className={cn(
                            'relative min-h-[60px] sm:min-h-[80px] p-1 rounded-lg border text-left transition-all',
                            isCurrentMonth ? 'bg-card hover:bg-accent/50' : 'bg-muted/20 text-muted-foreground/60',
                            isToday && 'ring-2 ring-primary/60',
                            isSelected && 'bg-accent ring-2 ring-primary',
                          )}
                        >
                          <span className={cn(
                            'text-xs font-medium inline-flex items-center justify-center',
                            isToday && 'bg-primary text-primary-foreground rounded-full w-6 h-6'
                          )}>
                            {format(day, 'd')}
                          </span>
                          <div className="mt-0.5 space-y-0.5">
                            {dayEvts.slice(0, 3).map(evt => (
                              <div
                                key={evt.id}
                                className="text-[10px] truncate rounded px-1 py-0.5 text-white font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: evt.color }}
                                onClick={(e) => { e.stopPropagation(); setShowEventDetail(evt); }}
                              >
                                {!evt.all_day && evt.start_time && (
                                  <span className="opacity-80 mr-0.5">{evt.start_time.substring(0, 5)}</span>
                                )}
                                {evt.title}
                              </div>
                            ))}
                            {dayEvts.length > 3 && (
                              <span className="text-[10px] text-muted-foreground font-medium">+{dayEvts.length - 3} más</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Week View */}
              {viewMode === 'week' && (
                <div className="overflow-hidden">
                  {/* Day headers */}
                  <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b">
                    <div className="text-xs text-muted-foreground p-1" />
                    {weekDays.map(day => {
                      const isToday = isDateToday(day);
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            'text-center py-2 border-l cursor-pointer hover:bg-accent/30 transition-colors',
                            isToday && 'bg-primary/5'
                          )}
                          onClick={() => { setSelectedDate(day); }}
                          onDoubleClick={() => openNewEvent(day)}
                        >
                          <div className="text-[10px] uppercase text-muted-foreground font-medium">
                            {format(day, 'EEE', { locale: es })}
                          </div>
                          <div className={cn(
                            'text-sm font-semibold inline-flex items-center justify-center w-7 h-7 rounded-full',
                            isToday && 'bg-primary text-primary-foreground'
                          )}>
                            {format(day, 'd')}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* All-day events row */}
                  {(() => {
                    const hasAllDay = weekDays.some(day =>
                      getEventsForDay(day).some(e => e.all_day)
                    );
                    if (!hasAllDay) return null;
                    return (
                      <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b bg-muted/20">
                        <div className="text-[10px] text-muted-foreground p-1 flex items-center justify-center">
                          Todo día
                        </div>
                        {weekDays.map(day => {
                          const allDayEvts = getEventsForDay(day).filter(e => e.all_day);
                          return (
                            <div key={day.toISOString()} className="border-l p-0.5 min-h-[28px]">
                              {allDayEvts.map(evt => (
                                <div
                                  key={evt.id}
                                  className="text-[10px] truncate rounded px-1 py-0.5 text-white font-medium cursor-pointer hover:opacity-80"
                                  style={{ backgroundColor: evt.color }}
                                  onClick={() => setShowEventDetail(evt)}
                                >
                                  {evt.title}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Time grid */}
                  <ScrollArea className="h-[500px]">
                    <div className="grid grid-cols-[50px_repeat(7,1fr)] relative">
                      {/* Hour labels + grid lines */}
                      {HOURS.map(hour => (
                        <div key={hour} className="contents">
                          <div className="h-16 text-[10px] text-muted-foreground text-right pr-2 pt-0 border-b">
                            {`${String(hour).padStart(2, '0')}:00`}
                          </div>
                          {weekDays.map(day => {
                            const isToday = isDateToday(day);
                            return (
                              <div
                                key={`${day.toISOString()}-${hour}`}
                                className={cn(
                                  'h-16 border-l border-b relative cursor-pointer hover:bg-accent/20 transition-colors',
                                  isToday && 'bg-primary/[0.03]'
                                )}
                                onClick={() => openNewEvent(day, hour)}
                              />
                            );
                          })}
                        </div>
                      ))}

                      {/* Positioned events */}
                      {weekDays.map((day, dayIndex) => {
                        const dayEvts = getEventsForDay(day).filter(e => !e.all_day);
                        return dayEvts.map(evt => {
                          const { top, height } = getEventTopAndHeight(evt);
                          const leftPercent = ((dayIndex + 1) / 8) * 100;
                          const widthPercent = (1 / 8) * 100;

                          return (
                            <div
                              key={evt.id}
                              className="absolute rounded-md px-1.5 py-0.5 text-white text-[11px] font-medium cursor-pointer overflow-hidden hover:opacity-90 hover:shadow-md transition-all z-10"
                              style={{
                                backgroundColor: evt.color,
                                top: `${top}px`,
                                height: `${height}px`,
                                left: `calc(${leftPercent}% + 2px)`,
                                width: `calc(${widthPercent}% - 4px)`,
                              }}
                              onClick={() => setShowEventDetail(evt)}
                            >
                              <div className="truncate leading-tight">{evt.title}</div>
                              {height > 30 && (
                                <div className="text-[10px] opacity-80 truncate">
                                  {evt.start_time?.substring(0, 5)} - {evt.end_time?.substring(0, 5)}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })}

                      {/* Current time indicator */}
                      {weekDays.some(d => isDateToday(d)) && (() => {
                        const now = new Date();
                        const nowMinutes = now.getHours() * 60 + now.getMinutes();
                        const baseMinutes = 7 * 60;
                        if (nowMinutes < baseMinutes || nowMinutes > 22 * 60) return null;
                        const top = ((nowMinutes - baseMinutes) / 60) * 64;
                        const todayIndex = weekDays.findIndex(d => isDateToday(d));
                        const leftPercent = ((todayIndex + 1) / 8) * 100;
                        const widthPercent = (1 / 8) * 100;

                        return (
                          <div
                            className="absolute h-0.5 bg-destructive z-20"
                            style={{
                              top: `${top}px`,
                              left: `calc(${leftPercent}%)`,
                              width: `calc(${widthPercent}%)`,
                            }}
                          >
                            <div className="absolute -left-1.5 -top-1 w-3 h-3 rounded-full bg-destructive" />
                          </div>
                        );
                      })()}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected day events (month view) */}
          {viewMode === 'month' && selectedDate && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">
                    {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => openNewEvent(selectedDate)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Añadir
                  </Button>
                </div>
                {dayEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sin eventos para este día</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayEvents.map(evt => (
                      <div
                        key={evt.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors group"
                        onClick={() => setShowEventDetail(evt)}
                      >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: evt.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{evt.title}</p>
                          {!evt.all_day && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {evt.start_time?.substring(0, 5)}{evt.end_time && ` - ${evt.end_time.substring(0, 5)}`}
                            </p>
                          )}
                          {evt.all_day && <Badge variant="secondary" className="text-[10px] h-4">Todo el día</Badge>}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="shrink-0 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(evt.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">

          {/* ── Quick Add Panel ── */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02]">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-primary">
                <Zap className="w-4 h-4" />
                Agregar rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Title */}
              <Input
                id="quick-add-title"
                placeholder="Título del evento…"
                value={quickAdd.title}
                onChange={e => setQuickAdd(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
                className="h-8 text-sm"
              />

              {/* Date */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Fecha</Label>
                <Input
                  type="date"
                  value={quickAdd.date}
                  onChange={e => setQuickAdd(p => ({ ...p, date: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>

              {/* All-day toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="quick-all-day"
                  checked={quickAdd.all_day}
                  onCheckedChange={v => setQuickAdd(p => ({ ...p, all_day: v }))}
                  className="scale-90"
                />
                <Label htmlFor="quick-all-day" className="text-xs cursor-pointer">Todo el día</Label>
              </div>

              {/* Time range */}
              {!quickAdd.all_day && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Inicio</Label>
                    <Input
                      type="time"
                      value={quickAdd.start_time}
                      onChange={e => setQuickAdd(p => ({ ...p, start_time: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Fin</Label>
                    <Input
                      type="time"
                      value={quickAdd.end_time}
                      onChange={e => setQuickAdd(p => ({ ...p, end_time: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Color picker */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Color</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      className={cn(
                        'w-6 h-6 rounded-full transition-all hover:scale-110',
                        quickAdd.color === c.value && 'ring-2 ring-offset-2 ring-primary scale-110'
                      )}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setQuickAdd(p => ({ ...p, color: c.value }))}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Submit */}
              <Button
                className="w-full h-8 text-sm gap-1.5"
                onClick={handleQuickAdd}
                disabled={!quickAdd.title.trim() || quickAdding}
              >
                <Plus className="w-3.5 h-3.5" />
                {quickAdding ? 'Añadiendo…' : 'Añadir evento'}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                O usa <span className="font-medium">doble clic</span> en cualquier día del calendario
              </p>
            </CardContent>
          </Card>

          {/* Próximos eventos */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                Próximos eventos
              </h3>
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No hay eventos próximos</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map(evt => (
                    <div
                      key={evt.id}
                      className="flex items-start gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => setShowEventDetail(evt)}
                    >
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: evt.color }} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{evt.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(parseISO(evt.event_date), "EEE d MMM", { locale: es })}
                          {!evt.all_day && evt.start_time && ` · ${evt.start_time.substring(0, 5)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3">Resumen</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Eventos este mes</span>
                  <span className="font-medium">
                    {events.filter(e => {
                      const d = parseISO(e.event_date);
                      return isSameMonth(d, currentDate);
                    }).length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Eventos hoy</span>
                  <span className="font-medium">
                    {events.filter(e => isDateToday(parseISO(e.event_date))).length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Compartidos conmigo</span>
                  <span className="font-medium">
                    {events.filter(e => e.creator_id !== user?.id).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EventDetailDialog
        event={showEventDetail}
        onClose={() => setShowEventDetail(null)}
        onEdit={openEditEvent}
        onDelete={(id) => setShowDeleteConfirm(id)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!showDeleteConfirm}
        onOpenChange={() => setShowDeleteConfirm(null)}
        title="Eliminar evento"
        description="¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => showDeleteConfirm && handleDeleteEvent(showDeleteConfirm)}
      />

      <EventFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        formData={formData}
        setFormData={setFormData}
        editingEvent={editingEvent}
        users={users}
        onSubmit={handleSubmit}
        onDelete={(id) => setShowDeleteConfirm(id)}
        toggleUserSelection={toggleUserSelection}
        updateUserPermission={updateUserPermission}
      />
    </div>
  );
}
