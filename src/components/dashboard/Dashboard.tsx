import { StatCard } from './StatCard';
import { LeadsByStatusChart } from './LeadsByStatusChart';
import { RecentLeads } from './RecentLeads';
import { UpcomingReminders } from './UpcomingReminders';
import { CompanyReminders } from './CompanyReminders';
import { RecentTickets } from './RecentTickets';
import { useLeads, useDashboardStats } from '@/hooks/useLeads';
import { useDashboardConfig, DashboardWidget } from '@/hooks/useDashboardConfig';
import { Users, UserPlus, TrendingUp, Target, Loader2, Pencil, X, Plus, RotateCcw, GripVertical, Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ConversionFunnel } from '@/components/reports/ConversionFunnel';
import { ActivityStats } from '@/components/reports/ActivityStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardProps {
  onViewLead: (id: string) => void;
}

function WidgetWrapper({ widget, editMode, onResize, children }: {
  widget: DashboardWidget;
  editMode: boolean;
  onResize: (id: string, width: 1 | 2 | 3) => void;
  children: React.ReactNode;
}) {
  const colSpan = widget.width === 3 ? 'lg:col-span-3' : widget.width === 2 ? 'lg:col-span-2' : 'lg:col-span-1';

  return (
    <div className={cn('col-span-1', colSpan, editMode && 'ring-2 ring-dashed ring-primary/30 rounded-xl relative')}>
      {editMode && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {widget.width > 1 && (
            <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => onResize(widget.id, (widget.width - 1) as 1 | 2)}>
              <Minimize2 className="h-3 w-3" />
            </Button>
          )}
          {widget.width < 3 && (
            <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => onResize(widget.id, (widget.width + 1) as 2 | 3)}>
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function WidgetContent({ widget, stats, leads, onViewLead }: {
  widget: DashboardWidget;
  stats: any;
  leads: any[];
  onViewLead: (id: string) => void;
}) {
  switch (widget.type) {
    case 'stats':
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6 col-span-full">
          <StatCard title="Total Leads" value={stats.totalLeads} subtitle="En tu base de datos" icon={Users} variant="primary" />
          <StatCard title="Nuevos esta semana" value={stats.thisWeekLeads} icon={UserPlus} trend={{ value: 15, isPositive: true }} />
          <StatCard title="Tasa de conversión" value={`${stats.conversionRate}%`} subtitle="Leads → Clientes" icon={TrendingUp} variant="accent" />
          <StatCard title="Clientes activos" value={stats.clients} icon={Target} />
        </div>
      );
    case 'leads-chart':
      return <LeadsByStatusChart stats={stats} />;
    case 'recent-leads':
      return <RecentLeads leads={leads} onViewLead={onViewLead} />;
    case 'reminders':
      return <UpcomingReminders onLeadClick={onViewLead} />;
    case 'company-reminders':
      return <CompanyReminders />;
    case 'tickets':
      return <RecentTickets />;
    case 'inbox-preview':
      return (
        <Card><CardHeader><CardTitle className="text-sm">📬 Inbox</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Acceso rápido a tu bandeja de entrada. Haz click en "Inbox" en el sidebar.</p></CardContent>
        </Card>
      );
    case 'whatsapp-preview':
      return (
        <Card><CardHeader><CardTitle className="text-sm">💬 WhatsApp</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Vista rápida de tus conversaciones de WhatsApp.</p></CardContent>
        </Card>
      );
    case 'ai-chat-quick':
      return (
        <Card><CardHeader><CardTitle className="text-sm">🤖 Chat IA</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Acceso directo al asistente de IA para consultas rápidas.</p></CardContent>
        </Card>
      );
    case 'map-preview':
      return (
        <Card><CardHeader><CardTitle className="text-sm">🗺️ Mapa de Leads</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Visualiza la distribución geográfica de tus leads.</p></CardContent>
        </Card>
      );
    case 'conversion-funnel':
      return null; // Needs stats context from reports page
    case 'activity-stats':
      return <ActivityStats />;
    default:
      return null;
  }
}

export function Dashboard({ onViewLead }: DashboardProps) {
  const { leads, isLoading: leadsLoading } = useLeads();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { widgets, isLoading: configLoading, editMode, setEditMode, toggleWidget, reorderWidgets, resizeWidget, resetToDefault } = useDashboardConfig();

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

  const visibleWidgets = widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    reorderWidgets(result.source.index, result.destination.index);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 lg:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-0.5 md:mt-1">
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
              <Button variant={editMode ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setEditMode(true)}>
                {editMode ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{editMode ? 'Cerrar Panel' : 'Editar'}</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-80 bg-background">
              <SheetHeader>
                <SheetTitle>Bloques del Dashboard</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3">
                {widgets.map(w => (
                  <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
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
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar por defecto
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          {editMode && (
            <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Widgets Grid */}
      {editMode ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="dashboard-widgets">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                {visibleWidgets.map((widget, index) => (
                  <Draggable key={widget.id} draggableId={widget.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          'col-span-1',
                          widget.type === 'stats' ? 'lg:col-span-3' : widget.width === 3 ? 'lg:col-span-3' : widget.width === 2 ? 'lg:col-span-2' : 'lg:col-span-1',
                          snapshot.isDragging && 'opacity-80 shadow-2xl'
                        )}
                      >
                        <div className="ring-2 ring-dashed ring-primary/30 rounded-xl relative">
                          <div {...provided.dragHandleProps} className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing p-1 rounded bg-background/80 backdrop-blur-sm">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="absolute top-2 right-2 z-10 flex gap-1">
                            {widget.type !== 'stats' && widget.width > 1 && (
                              <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => resizeWidget(widget.id, (widget.width - 1) as 1 | 2)}>
                                <Minimize2 className="h-3 w-3" />
                              </Button>
                            )}
                            {widget.type !== 'stats' && widget.width < 3 && (
                              <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => resizeWidget(widget.id, (widget.width + 1) as 2 | 3)}>
                                <Maximize2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <WidgetContent widget={widget} stats={dashboardStats} leads={leads} onViewLead={onViewLead} />
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {visibleWidgets.map(widget => (
            <div
              key={widget.id}
              className={cn(
                'col-span-1',
                widget.type === 'stats' ? 'lg:col-span-3' : widget.width === 3 ? 'lg:col-span-3' : widget.width === 2 ? 'lg:col-span-2' : 'lg:col-span-1',
              )}
            >
              <WidgetContent widget={widget} stats={dashboardStats} leads={leads} onViewLead={onViewLead} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
