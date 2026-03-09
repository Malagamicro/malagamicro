import { useRef, useState, useEffect } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { StatCard } from './StatCard';
import { LeadsByStatusChart } from './LeadsByStatusChart';
import { RecentLeads } from './RecentLeads';
import { UpcomingReminders } from './UpcomingReminders';
import { CompanyReminders } from './CompanyReminders';
import { RecentTickets } from './RecentTickets';
import { ActivityStats } from '@/components/reports/ActivityStats';
import { OnlineUsersWidget } from './OnlineUsersWidget';
import { ConversionFunnel } from '@/components/reports/ConversionFunnel';
import { useLeads, useDashboardStats } from '@/hooks/useLeads';
import { useDashboardConfig, DashboardWidget } from '@/hooks/useDashboardConfig';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import {
  Users, UserPlus, TrendingUp, Target, Loader2, Pencil, RotateCcw,
  Eye, EyeOff, Lock, Unlock, BarChart3, PieChart, Bell, Building,
  Ticket, Wifi, Inbox, MessageSquare, Bot, MapPin, Activity, CalendarDays,
  Receipt, Filter, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, isToday, isTomorrow, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import mascotImage from '@/assets/mascot.png';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Icon map for widget previews
const ICON_MAP: Record<string, any> = {
  BarChart3, PieChart, Users, Bell, Building, Ticket, Wifi, Inbox,
  MessageSquare, Bot, MapPin, Activity, CalendarDays, Receipt, Filter,
};

// Preview descriptions for each widget type
const WIDGET_PREVIEWS: Record<string, { description: string; emoji: string }> = {
  'stats': { description: '4 tarjetas con KPIs principales', emoji: '📊' },
  'leads-chart': { description: 'Gráfico circular de leads por estado', emoji: '🥧' },
  'recent-leads': { description: 'Lista de los últimos leads añadidos', emoji: '👥' },
  'reminders': { description: 'Próximos recordatorios de seguimiento', emoji: '🔔' },
  'company-reminders': { description: 'Recordatorios asignados a la empresa', emoji: '🏢' },
  'tickets': { description: 'Últimos tickets de soporte recibidos', emoji: '🎫' },
  'online-users': { description: 'Miembros del equipo conectados', emoji: '🟢' },
  'calendar-mini': { description: 'Eventos de hoy y próximos días', emoji: '📅' },
  'micro-chat': { description: 'Chat rápido con Micro', emoji: '🤖' },
  'inbox-preview': { description: 'Acceso rápido a tu bandeja de email', emoji: '📬' },
  'whatsapp-preview': { description: 'Vista rápida de conversaciones WA', emoji: '💬' },
  'ai-chat-quick': { description: 'Consultas rápidas al asistente IA', emoji: '🧠' },
  'map-preview': { description: 'Distribución geográfica de leads', emoji: '🗺️' },
  'activity-stats': { description: 'Resumen de actividad reciente', emoji: '📈' },
  'budget-summary': { description: 'Resumen de presupuestos pendientes', emoji: '💰' },
  'conversion-funnel': { description: 'Embudo de conversión de leads', emoji: '🔻' },
};

interface DashboardProps {
  onViewLead: (id: string) => void;
  onTabChange?: (tab: string) => void;
}

// Mini calendar widget
function MiniCalendarWidget() {
  const { events } = useCalendarEvents();
  const today = new Date();
  const upcomingEvents = (events || [])
    .filter(e => new Date(e.event_date) >= today)
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    .slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" /> Calendario
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcomingEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos próximos</p>
        ) : (
          upcomingEvents.map(ev => {
            const evDate = new Date(ev.event_date);
            const label = isToday(evDate) ? 'Hoy' : isTomorrow(evDate) ? 'Mañana' : format(evDate, 'd MMM', { locale: es });
            return (
              <div key={ev.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color || 'hsl(var(--primary))' }} />
                <span className="flex-1 truncate">{ev.title}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// Micro chat widget for dashboard
function MicroChatDashboardWidget() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mascot-chat', { body: { messages: allMsgs } });
      if (error) throw error;
      setMessages(prev => [...prev, { role: 'assistant', content: data?.response || 'Sin respuesta' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚡ Error, intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <img src={mascotImage} alt="Fluiditos" className="w-5 h-5" /> Chat Fluiditos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 gap-2">
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 pr-2">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Pregúntale algo a Fluiditos...</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn('text-xs p-2 rounded-lg max-w-[90%]', m.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted')}>
                {m.content}
              </div>
            ))}
            {loading && <div className="text-xs text-muted-foreground animate-pulse">Fluiditos está pensando...</div>}
          </div>
        </ScrollArea>
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Escribe..."
            className="text-xs h-8"
            disabled={loading}
          />
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={!input.trim() || loading}>
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Budget summary widget
function BudgetSummaryWidget() {
  const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0 });
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase.from('budget_requests').select('status').eq('user_id', user.id).then(({ data }) => {
      if (!data) return;
      setStats({
        total: data.length,
        pending: data.filter(d => d.status === 'pending').length,
        approved: data.filter(d => d.status === 'approved').length,
      });
    });
  }, [user]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" /> Presupuestos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10">
            <p className="text-lg font-bold text-destructive">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground">Pendientes</p>
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <p className="text-lg font-bold text-primary">{stats.approved}</p>
            <p className="text-[10px] text-muted-foreground">Aprobados</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WidgetContent({ widget, stats, leads, onViewLead, onTabChange }: {
  widget: DashboardWidget; stats: any; leads: any[]; onViewLead: (id: string) => void; onTabChange?: (tab: string) => void;
}) {
  switch (widget.type) {
    case 'stats':
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-full">
          <StatCard title="Total Leads" value={stats.totalLeads} subtitle="En tu base de datos" icon={Users} variant="primary" />
          <StatCard title="Nuevos esta semana" value={stats.thisWeekLeads} icon={UserPlus} trend={{ value: 15, isPositive: true }} />
          <StatCard title="Tasa de conversión" value={`${stats.conversionRate}%`} subtitle="Leads → Clientes" icon={TrendingUp} variant="accent" />
          <StatCard title="Clientes activos" value={stats.clients} icon={Target} />
        </div>
      );
    case 'leads-chart': return <LeadsByStatusChart stats={stats} />;
    case 'recent-leads': return <RecentLeads leads={leads} onViewLead={onViewLead} />;
    case 'reminders': return <UpcomingReminders onLeadClick={onViewLead} />;
    case 'company-reminders': return <CompanyReminders />;
    case 'tickets': return <RecentTickets onNavigateToTickets={() => onTabChange?.('osticket')} />;
    case 'online-users': return <OnlineUsersWidget />;
    case 'calendar-mini': return <MiniCalendarWidget />;
    case 'micro-chat': return <MicroChatDashboardWidget />;
    case 'budget-summary': return <BudgetSummaryWidget />;
    case 'conversion-funnel': return <ConversionFunnel stats={stats} />;
    case 'inbox-preview':
      return <Card className="h-full"><CardHeader className="pb-2"><CardTitle className="text-sm">📬 Inbox</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Acceso rápido a tu bandeja de entrada.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => onTabChange?.('email')}>Abrir Inbox</Button></CardContent></Card>;
    case 'whatsapp-preview':
      return <Card className="h-full"><CardHeader className="pb-2"><CardTitle className="text-sm">💬 WhatsApp</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Vista rápida de tus conversaciones.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => onTabChange?.('whatsapp')}>Abrir WhatsApp</Button></CardContent></Card>;
    case 'ai-chat-quick':
      return <Card className="h-full"><CardHeader className="pb-2"><CardTitle className="text-sm">🧠 Chat IA</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Asistente IA para consultas rápidas.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => onTabChange?.('chat-ia')}>Abrir Chat IA</Button></CardContent></Card>;
    case 'map-preview':
      return <Card className="h-full"><CardHeader className="pb-2"><CardTitle className="text-sm">🗺️ Mapa</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Distribución geográfica de leads.</p></CardContent></Card>;
    case 'activity-stats': return <ActivityStats />;
    default: return null;
  }
}

export function Dashboard({ onViewLead, onTabChange }: DashboardProps) {
  const { leads, isLoading: leadsLoading } = useLeads();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const {
    widgets, layouts, isLoading: configLoading,
    editMode, setEditMode, toggleWidget,
    onLayoutChange, resetToDefault, cols,
  } = useDashboardConfig();

  const isLoading = leadsLoading || statsLoading;

  if (isLoading || configLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const dashboardStats = stats || {
    totalLeads: 0, newLeads: 0, contactedLeads: 0, interestedLeads: 0,
    clients: 0, thisWeekLeads: 0, conversionRate: 0,
  };

  const visibleWidgets = widgets.filter(w => w.visible);
  const visibleLayouts = layouts.filter(l => visibleWidgets.some(w => w.id === l.i));

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-0.5">
            Resumen de actividad y prospección
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <Button variant="outline" size="sm" onClick={resetToDefault} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Restaurar</span>
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bloques</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[340px] bg-background z-[60]">
              <SheetHeader><SheetTitle>Bloques del Dashboard</SheetTitle></SheetHeader>
              <p className="text-sm text-muted-foreground mt-1">Activa o desactiva widgets. Los cambios se reflejan en tiempo real.</p>
              <ScrollArea className="h-[calc(100vh-200px)] mt-4">
                <div className="space-y-2 pr-2">
                  {widgets.map(w => {
                    const preview = WIDGET_PREVIEWS[w.type];
                    const IconComp = ICON_MAP[w.icon];
                    return (
                      <div key={w.id} className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-all",
                        w.visible ? "bg-card border-primary/20" : "bg-muted/30 border-transparent opacity-70"
                      )}>
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg",
                          w.visible ? "bg-primary/10" : "bg-muted"
                        )}>
                          {preview?.emoji || (IconComp ? <IconComp className="h-5 w-5 text-primary" /> : '📦')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block">{w.title}</span>
                          {preview && (
                            <span className="text-[11px] text-muted-foreground line-clamp-2">{preview.description}</span>
                          )}
                        </div>
                        <Switch checked={w.visible} onCheckedChange={() => toggleWidget(w.id)} className="flex-shrink-0 mt-0.5" />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="mt-4">
                <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={resetToDefault}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar por defecto
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Button variant={editMode ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setEditMode(!editMode)}>
            {editMode ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{editMode ? 'Bloquear' : 'Editar'}</span>
          </Button>
        </div>
      </div>

      {editMode && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 text-sm text-primary flex items-center gap-3">
          <Pencil className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <span>Modo edición activo — arrastra, redimensiona y activa/desactiva bloques.</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs bg-primary/20 px-2 py-0.5 rounded-full font-medium">{visibleWidgets.length}/{widgets.length} activos</span>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <ResponsiveGridLayout
        className="layout"
        layouts={{
          lg: visibleLayouts,
          md: visibleLayouts.map(l => ({ ...l, w: Math.min(l.w, 8) })),
          sm: visibleLayouts.map(l => ({ ...l, x: 0, w: 4 })),
        }}
        breakpoints={{ lg: 1200, md: 768, sm: 0 }}
        cols={{ lg: cols, md: 8, sm: 4 }}
        rowHeight={65}
        isDraggable={editMode}
        isResizable={editMode}
        onLayoutChange={(layout) => { if (editMode) onLayoutChange(layout); }}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
        margin={[16, 16]}
      >
        {visibleWidgets.map(widget => (
          <div key={widget.id} className={cn(
            "rounded-xl overflow-hidden bg-card shadow-sm border",
            editMode && "ring-2 ring-dashed ring-primary/30 bg-card/50"
          )}>
            {editMode && (
              <div className="widget-drag-handle absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background/80 to-transparent z-10 flex items-center justify-center cursor-grab active:cursor-grabbing">
                <div className="w-8 h-1 rounded-full bg-muted-foreground/40" />
              </div>
            )}
            <div className={cn("h-full overflow-auto", editMode && "pt-4")}>
              <WidgetContent widget={widget} stats={dashboardStats} leads={leads} onViewLead={onViewLead} onTabChange={onTabChange} />
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
