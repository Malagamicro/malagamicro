import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGeneralReminders } from '@/hooks/useGeneralReminders';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  PanelRightClose, PanelRight, CalendarDays, Bell, Bot,
  Clock, AlertTriangle, CheckCircle2, ChevronRight, MessageSquare,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import mascotImage from '@/assets/mascot.png';

interface RecentChatMessage {
  id: string;
  content: string | null;
  message_type: string;
  created_at: string;
  sender_name: string;
  conversation_name: string | null;
  conversation_id: string;
}

interface RightSidebarProps {
  onNavigate: (tab: string) => void;
}

export function RightSidebar({ onNavigate }: RightSidebarProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { pendingReminders, overdueReminders } = useGeneralReminders();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [recentMessages, setRecentMessages] = useState<RecentChatMessage[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Fetch calendar events for the selected date and upcoming
  useEffect(() => {
    if (!user?.id || !open) return;

    const fetchEvents = async () => {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const { data } = await supabase
        .from('calendar_events')
        .select('id, title, event_date, start_time, end_time, color, all_day')
        .gte('event_date', format(now, 'yyyy-MM-dd'))
        .lte('event_date', format(weekFromNow, 'yyyy-MM-dd'))
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(6);

      setCalendarEvents(data || []);
    };

    fetchEvents();
  }, [user?.id, open, selectedDate]);

  // Fetch recent internal chat messages
  useEffect(() => {
    if (!user?.id || !open) return;

    const fetchRecentMessages = async () => {
      // Get user's conversations
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!participations || participations.length === 0) {
        setRecentMessages([]);
        return;
      }

      const convIds = participations.map(p => p.conversation_id);

      // Get recent messages from those conversations (not from current user)
      const { data: messages } = await supabase
        .from('internal_messages')
        .select('id, content, message_type, created_at, sender_id, conversation_id')
        .in('conversation_id', convIds)
        .neq('sender_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!messages || messages.length === 0) {
        setRecentMessages([]);
        return;
      }

      // Get sender profiles and conversation names
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const convIdsFromMsgs = [...new Set(messages.map(m => m.conversation_id))];

      const [{ data: profiles }, { data: conversations }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', senderIds),
        supabase.from('internal_conversations').select('id, name, is_group').in('id', convIdsFromMsgs),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
      const convMap = new Map((conversations || []).map(c => [c.id, c]));

      setRecentMessages(messages.map(m => ({
        id: m.id,
        content: m.content,
        message_type: m.message_type,
        created_at: m.created_at,
        sender_name: profileMap.get(m.sender_id) || 'Usuario',
        conversation_name: convMap.get(m.conversation_id)?.is_group ? convMap.get(m.conversation_id)?.name || null : null,
        conversation_id: m.conversation_id,
      })));
    };

    fetchRecentMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('right-sidebar-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages' }, () => {
        fetchRecentMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, open]);

  // Show upcoming reminders (next 7 days + overdue)
  const relevantReminders = pendingReminders
    .filter(r => {
      const d = new Date(r.reminder_date);
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return d <= weekFromNow || isPast(d);
    })
    .slice(0, 8);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'normal': return 'text-blue-500';
      default: return 'text-muted-foreground';
    }
  };

  const getTimeLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isPast(d)) return 'Vencido';
    if (isToday(d)) return `Hoy ${format(d, 'HH:mm')}`;
    if (isTomorrow(d)) return `Mañana ${format(d, 'HH:mm')}`;
    return format(d, "d MMM HH:mm", { locale: es });
  };

  // Toggle button (always visible)
  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-2 top-1/2 -translate-y-1/2 z-40",
          "h-10 w-10 rounded-full bg-card border shadow-lg",
          "hover:bg-accent transition-all",
          isMobile && "right-1 h-8 w-8"
        )}
        title="Abrir panel lateral"
      >
        <PanelRight className="h-4 w-4" />
        {overdueReminders.length > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
            {overdueReminders.length}
          </span>
        )}
      </Button>
    );
  }

  return (
    <div className={cn(
      "fixed right-0 top-0 h-screen z-40",
      "bg-card/95 backdrop-blur-xl border-l shadow-2xl",
      "flex flex-col transition-all duration-300 animate-in slide-in-from-right",
      isMobile ? "w-[280px]" : "w-[300px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-semibold">Panel rápido</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Mini Calendar */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide">Calendario</span>
            </div>
            <div className="rounded-lg border bg-background p-1">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{
                  hasEvent: calendarEvents.map(ev => new Date(ev.event_date + 'T00:00:00')),
                }}
                modifiersClassNames={{
                  hasEvent: 'relative',
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayEvents = calendarEvents.filter(ev => ev.event_date === dateStr);
                    return (
                      <div className="relative flex flex-col items-center">
                        <span>{date.getDate()}</span>
                        {dayEvents.length > 0 && (
                          <div className="flex gap-0.5 absolute -bottom-1">
                            {dayEvents.slice(0, 3).map((ev, i) => (
                              <div
                                key={i}
                                className="w-1 h-1 rounded-full"
                                style={{ backgroundColor: ev.color || 'hsl(var(--primary))' }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  },
                }}
                className="p-1 pointer-events-auto [&_.rdp-months]:!flex-col [&_.rdp-caption]:text-xs [&_.rdp-cell]:!w-8 [&_.rdp-cell]:!h-8 [&_.rdp-head_cell]:!w-8 [&_.rdp-day]:!h-7 [&_.rdp-day]:!w-7 [&_.rdp-day]:text-xs"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 text-xs gap-1"
              onClick={() => onNavigate('calendario')}
            >
              Ver calendario completo <ChevronRight className="h-3 w-3" />
            </Button>

            {/* Events for upcoming days */}
            {calendarEvents.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Próximos eventos</p>
                {calendarEvents.map(ev => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-2 p-2 rounded-lg border text-xs hover:bg-accent/50 cursor-pointer"
                    onClick={() => onNavigate('calendario')}
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: ev.color || 'hsl(var(--primary))' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ev.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(ev.event_date), 'd MMM', { locale: es })}
                        {!ev.all_day && ev.start_time && ` ${ev.start_time.slice(0, 5)}`}
                        {!ev.all_day && ev.end_time && `–${ev.end_time.slice(0, 5)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reminders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide">Recordatorios</span>
              </div>
              {overdueReminders.length > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {overdueReminders.length} vencidos
                </Badge>
              )}
            </div>

            {relevantReminders.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Sin recordatorios pendientes</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {relevantReminders.map(r => {
                  const isOverdue = isPast(new Date(r.reminder_date));
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-lg border text-xs transition-colors hover:bg-accent/50 cursor-pointer",
                        isOverdue && "border-destructive/30 bg-destructive/5"
                      )}
                      onClick={() => onNavigate('reminders')}
                    >
                      <div className={cn("mt-0.5", isOverdue ? "text-destructive" : getPriorityColor(r.priority))}>
                        {isOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{r.title}</p>
                        <p className={cn("text-[10px]", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                          {getTimeLabel(r.reminder_date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 text-xs gap-1"
              onClick={() => onNavigate('reminders')}
            >
              Ver todos <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Internal Chat - Recent messages */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide">Chat interno</span>
              </div>
              {recentMessages.length > 0 && (
                <Badge className="text-[10px] px-1.5 py-0">
                  {recentMessages.length} nuevos
                </Badge>
              )}
            </div>

            {recentMessages.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Sin mensajes recientes</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentMessages.map(m => {
                  const preview = m.message_type === 'text'
                    ? (m.content || 'Mensaje')
                    : m.message_type === 'image'
                      ? '📷 Imagen'
                      : m.message_type === 'audio'
                        ? '🎵 Audio'
                        : '📎 Archivo';
                  return (
                    <div
                      key={m.id}
                      className="flex items-start gap-2 p-2 rounded-lg border text-xs transition-colors hover:bg-accent/50 cursor-pointer"
                      onClick={() => onNavigate('mensajes')}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {m.sender_name}
                          {m.conversation_name && <span className="text-muted-foreground font-normal"> en {m.conversation_name}</span>}
                        </p>
                        <p className="text-muted-foreground truncate">{preview}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 text-xs gap-1"
              onClick={() => onNavigate('mensajes')}
            >
              Ver todos <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          {/* AI Chat shortcut */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide">Asistente IA</span>
            </div>
            <button
              onClick={() => onNavigate('chat-ai')}
              className="w-full flex items-center gap-3 p-3 rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-card border flex items-center justify-center shadow-sm">
                <img src={mascotImage} alt="Micro" className="w-8 h-8 object-contain" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium">Chat con Micro</p>
                <p className="text-[10px] text-muted-foreground">Búsqueda IA en tiempo real</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
