import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Layout } from 'react-grid-layout';

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  icon: string;
  visible: boolean;
  minW?: number;
  minH?: number;
}

export interface DashboardConfig {
  widgets: DashboardWidget[];
  layouts: Layout[];
}

const COLS = 12;

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'stats', type: 'stats', title: 'Estadísticas', icon: 'BarChart3', visible: true, minW: 4, minH: 2 },
  { id: 'leads-chart', type: 'leads-chart', title: 'Leads por Estado', icon: 'PieChart', visible: true, minW: 3, minH: 4 },
  { id: 'recent-leads', type: 'recent-leads', title: 'Leads Recientes', icon: 'Users', visible: true, minW: 3, minH: 4 },
  { id: 'reminders', type: 'reminders', title: 'Recordatorios', icon: 'Bell', visible: true, minW: 3, minH: 4 },
  { id: 'company-reminders', type: 'company-reminders', title: 'Recordatorios Empresa', icon: 'Building', visible: true, minW: 3, minH: 3 },
  { id: 'tickets', type: 'tickets', title: 'Tickets Recientes', icon: 'Ticket', visible: true, minW: 3, minH: 4 },
  { id: 'inbox-preview', type: 'inbox-preview', title: 'Inbox Preview', icon: 'Inbox', visible: false, minW: 3, minH: 3 },
  { id: 'whatsapp-preview', type: 'whatsapp-preview', title: 'WhatsApp Preview', icon: 'MessageSquare', visible: false, minW: 3, minH: 3 },
  { id: 'ai-chat-quick', type: 'ai-chat-quick', title: 'Chat IA Rápido', icon: 'Bot', visible: false, minW: 3, minH: 3 },
  { id: 'map-preview', type: 'map-preview', title: 'Mapa de Leads', icon: 'MapPin', visible: false, minW: 4, minH: 4 },
  { id: 'activity-stats', type: 'activity-stats', title: 'Actividad Reciente', icon: 'Activity', visible: false, minW: 3, minH: 4 },
];

const DEFAULT_LAYOUTS: Layout[] = [
  { i: 'stats', x: 0, y: 0, w: 12, h: 2, minW: 4, minH: 2 },
  { i: 'leads-chart', x: 0, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
  { i: 'recent-leads', x: 4, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
  { i: 'reminders', x: 8, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
  { i: 'company-reminders', x: 0, y: 7, w: 6, h: 5, minW: 3, minH: 3 },
  { i: 'tickets', x: 6, y: 7, w: 6, h: 5, minW: 3, minH: 4 },
];

export function useDashboardConfig() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);
  const [layouts, setLayouts] = useState<Layout[]>(DEFAULT_LAYOUTS);
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadConfig();
  }, [user]);

  const loadConfig = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_dashboard_config')
        .select('widgets')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.widgets) {
        const saved = data.widgets as unknown as DashboardConfig;
        if (saved.widgets && saved.layouts) {
          // Merge with defaults for any new widgets
          const merged = DEFAULT_WIDGETS.map(dw => {
            const found = saved.widgets.find(sw => sw.id === dw.id);
            return found ? { ...dw, ...found } : dw;
          });
          setWidgets(merged);
          setLayouts(saved.layouts);
        }
      }
    } catch (err) {
      console.error('Error loading dashboard config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = useCallback(async (newWidgets: DashboardWidget[], newLayouts: Layout[]) => {
    if (!user) return;
    try {
      const config: DashboardConfig = { widgets: newWidgets, layouts: newLayouts };
      const { error } = await supabase
        .from('user_dashboard_config')
        .upsert({
          user_id: user.id,
          widgets: config as any,
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving dashboard config:', err);
      toast.error('Error al guardar la configuración');
    }
  }, [user]);

  const onLayoutChange = (newLayout: Layout[]) => {
    setLayouts(newLayout);
    saveConfig(widgets, newLayout);
  };

  const toggleWidget = (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    const newVisible = !widget.visible;
    const updatedWidgets = widgets.map(w =>
      w.id === widgetId ? { ...w, visible: newVisible } : w
    );

    let updatedLayouts = [...layouts];
    if (newVisible) {
      // Add layout entry for newly visible widget
      const maxY = layouts.reduce((max, l) => Math.max(max, l.y + l.h), 0);
      updatedLayouts.push({
        i: widgetId,
        x: 0,
        y: maxY,
        w: widget.minW || 4,
        h: widget.minH || 4,
        minW: widget.minW || 3,
        minH: widget.minH || 3,
      });
    } else {
      updatedLayouts = updatedLayouts.filter(l => l.i !== widgetId);
    }

    setWidgets(updatedWidgets);
    setLayouts(updatedLayouts);
    saveConfig(updatedWidgets, updatedLayouts);
  };

  const resetToDefault = () => {
    setWidgets(DEFAULT_WIDGETS);
    setLayouts(DEFAULT_LAYOUTS);
    saveConfig(DEFAULT_WIDGETS, DEFAULT_LAYOUTS);
    toast.success('Dashboard restaurado a valores por defecto');
  };

  return {
    widgets,
    layouts,
    isLoading,
    editMode,
    setEditMode,
    toggleWidget,
    onLayoutChange,
    resetToDefault,
    cols: COLS,
  };
}
