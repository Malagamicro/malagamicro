import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  icon: string;
  width: 1 | 2 | 3; // grid columns
  visible: boolean;
  order: number;
}

const AVAILABLE_WIDGETS: DashboardWidget[] = [
  { id: 'stats', type: 'stats', title: 'Estadísticas', icon: 'BarChart3', width: 3, visible: true, order: 0 },
  { id: 'leads-chart', type: 'leads-chart', title: 'Leads por Estado', icon: 'PieChart', width: 1, visible: true, order: 1 },
  { id: 'recent-leads', type: 'recent-leads', title: 'Leads Recientes', icon: 'Users', width: 1, visible: true, order: 2 },
  { id: 'reminders', type: 'reminders', title: 'Recordatorios', icon: 'Bell', width: 1, visible: true, order: 3 },
  { id: 'company-reminders', type: 'company-reminders', title: 'Recordatorios Empresa', icon: 'Building', width: 1, visible: true, order: 4 },
  { id: 'tickets', type: 'tickets', title: 'Tickets Recientes', icon: 'Ticket', width: 1, visible: true, order: 5 },
  { id: 'inbox-preview', type: 'inbox-preview', title: 'Inbox Preview', icon: 'Inbox', width: 1, visible: false, order: 6 },
  { id: 'whatsapp-preview', type: 'whatsapp-preview', title: 'WhatsApp Preview', icon: 'MessageSquare', width: 1, visible: false, order: 7 },
  { id: 'ai-chat-quick', type: 'ai-chat-quick', title: 'Chat IA Rápido', icon: 'Bot', width: 1, visible: false, order: 8 },
  { id: 'map-preview', type: 'map-preview', title: 'Mapa de Leads', icon: 'MapPin', width: 2, visible: false, order: 9 },
  { id: 'conversion-funnel', type: 'conversion-funnel', title: 'Embudo de Conversión', icon: 'TrendingUp', width: 1, visible: false, order: 10 },
  { id: 'activity-stats', type: 'activity-stats', title: 'Actividad Reciente', icon: 'Activity', width: 1, visible: false, order: 11 },
];

export function useDashboardConfig() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<DashboardWidget[]>(AVAILABLE_WIDGETS);
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
        const saved = data.widgets as unknown as DashboardWidget[];
        // Merge saved with available (in case new widgets were added)
        const merged = AVAILABLE_WIDGETS.map(aw => {
          const found = saved.find(s => s.id === aw.id);
          return found ? { ...aw, ...found } : aw;
        });
        merged.sort((a, b) => a.order - b.order);
        setWidgets(merged);
      }
    } catch (err) {
      console.error('Error loading dashboard config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = useCallback(async (newWidgets: DashboardWidget[]) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_dashboard_config')
        .upsert({
          user_id: user.id,
          widgets: newWidgets as any,
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving dashboard config:', err);
      toast.error('Error al guardar la configuración');
    }
  }, [user]);

  const toggleWidget = (widgetId: string) => {
    const updated = widgets.map(w =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    );
    setWidgets(updated);
    saveConfig(updated);
  };

  const reorderWidgets = (fromIndex: number, toIndex: number) => {
    const visibleWidgets = widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);
    const [moved] = visibleWidgets.splice(fromIndex, 1);
    visibleWidgets.splice(toIndex, 0, moved);
    
    const reordered = widgets.map(w => {
      const idx = visibleWidgets.findIndex(vw => vw.id === w.id);
      return idx >= 0 ? { ...w, order: idx } : w;
    });
    
    setWidgets(reordered);
    saveConfig(reordered);
  };

  const resizeWidget = (widgetId: string, width: 1 | 2 | 3) => {
    const updated = widgets.map(w =>
      w.id === widgetId ? { ...w, width } : w
    );
    setWidgets(updated);
    saveConfig(updated);
  };

  const resetToDefault = () => {
    setWidgets(AVAILABLE_WIDGETS);
    saveConfig(AVAILABLE_WIDGETS);
    toast.success('Dashboard restaurado a valores por defecto');
  };

  return {
    widgets,
    isLoading,
    editMode,
    setEditMode,
    toggleWidget,
    reorderWidgets,
    resizeWidget,
    resetToDefault,
    availableWidgets: AVAILABLE_WIDGETS,
  };
}
