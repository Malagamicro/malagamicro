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
import { useLeads, useDashboardStats } from '@/hooks/useLeads';
import { useDashboardConfig, DashboardWidget } from '@/hooks/useDashboardConfig';
import { Users, UserPlus, TrendingUp, Target, Loader2, Pencil, RotateCcw, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardProps {
  onViewLead: (id: string) => void;
  onTabChange?: (tab: string) => void;
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
    case 'inbox-preview':
      return <Card className="h-full"><CardHeader className="pb-2"><CardTitle className="text-sm">📬 Inbox</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Acceso rápido a tu bandeja de entrada.</p></CardContent></Card>;
    case 'whatsapp-preview':
      return <Card className="h-full"><CardHeader className="pb-2"><CardTitle className="text-sm">💬 WhatsApp</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Vista rápida de tus conversaciones.</p></CardContent></Card>;
    case 'ai-chat-quick':
      return <Card className="h-full"><CardHeader className="pb-2"><CardTitle className="text-sm">🤖 Chat IA</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Asistente IA para consultas rápidas.</p></CardContent></Card>;
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
            <SheetContent className="w-80 bg-background z-[60]">
              <SheetHeader><SheetTitle>Bloques del Dashboard</SheetTitle></SheetHeader>
              <p className="text-sm text-muted-foreground mt-1">Activa o desactiva widgets. Los cambios se reflejan en tiempo real.</p>
              <div className="mt-4 space-y-2">
                {widgets.map(w => (
                  <div key={w.id} className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    w.visible ? "bg-card border-primary/20" : "bg-muted/30 border-transparent opacity-60"
                  )}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {w.visible ? <Eye className="h-4 w-4 text-primary flex-shrink-0" /> : <EyeOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      <span className="text-sm font-medium truncate">{w.title}</span>
                    </div>
                    <Switch checked={w.visible} onCheckedChange={() => toggleWidget(w.id)} />
                  </div>
                ))}
              </div>
              <div className="mt-6">
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
            <span>Modo edición activo — arrastra, redimensiona y activa/desactiva bloques. Los cambios se previsualizan en tiempo real.</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs bg-primary/20 px-2 py-0.5 rounded-full font-medium">{visibleWidgets.length}/{widgets.length} activos</span>
          </div>
        </div>
      )}

      {/* Grid Layout — responsive breakpoints with adapted layouts */}
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
