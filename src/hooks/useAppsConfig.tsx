import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AppItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgGradient: string;
  hidden?: boolean;
}

export interface AppCategory {
  id: string;
  label: string;
  items: AppItem[];
}

const DEFAULT_APP_CATEGORIES: AppCategory[] = [
  {
    id: 'comunicacion',
    label: 'Comunicación',
    items: [
      { id: 'inbox', label: 'Inbox', description: 'Notificaciones', icon: 'Inbox', color: 'text-teal-500', bgGradient: 'from-teal-500/20 to-teal-600/10' },
      { id: 'correo', label: 'Correo', description: 'Email completo', icon: 'Mail', color: 'text-blue-500', bgGradient: 'from-blue-500/20 to-blue-600/10' },
      { id: 'mensajes', label: 'Chat Interno', description: 'Mensajería del equipo', icon: 'MessagesSquare', color: 'text-sky-500', bgGradient: 'from-sky-500/20 to-sky-600/10' },
      { id: 'osticket', label: 'Tickets', description: 'Soporte osTicket', icon: 'Ticket', color: 'text-yellow-500', bgGradient: 'from-yellow-500/20 to-yellow-600/10' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { id: 'campaigns', label: 'Campañas', description: 'Email marketing', icon: 'Megaphone', color: 'text-pink-500', bgGradient: 'from-pink-500/20 to-pink-600/10' },
      { id: 'whatsapp', label: 'WhatsApp', description: 'Mensajería directa', icon: 'MessageSquare', color: 'text-green-500', bgGradient: 'from-green-500/20 to-green-600/10' },
      { id: 'templates', label: 'Plantillas', description: 'Mensajes predefinidos', icon: 'FileText', color: 'text-amber-500', bgGradient: 'from-amber-500/20 to-amber-600/10' },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestión',
    items: [
      { id: 'calendario', label: 'Calendario', description: 'Eventos y citas', icon: 'Calendar', color: 'text-blue-500', bgGradient: 'from-blue-500/20 to-blue-600/10' },
      { id: 'informes', label: 'Informes', description: 'Reportes detallados', icon: 'BarChart3', color: 'text-emerald-500', bgGradient: 'from-emerald-500/20 to-emerald-600/10' },
      { id: 'reminders', label: 'Recordatorios', description: 'Alertas y tareas', icon: 'Bell', color: 'text-rose-400', bgGradient: 'from-rose-500/20 to-rose-600/10' },
      { id: 'shared-files', label: 'Archivos', description: 'Almacenamiento compartido', icon: 'Cloud', color: 'text-slate-500', bgGradient: 'from-slate-500/20 to-slate-600/10' },
    ],
  },
  {
    id: 'herramientas-ia',
    label: 'Herramientas IA',
    items: [
      { id: 'chat-ai', label: 'Chat IA', description: 'Asistente inteligente', icon: 'Bot', color: 'text-violet-500', bgGradient: 'from-violet-500/20 to-violet-600/10' },
      { id: 'editor', label: 'Editor IA', description: 'Documentos con IA', icon: 'FileEdit', color: 'text-emerald-500', bgGradient: 'from-emerald-500/20 to-emerald-600/10' },
      { id: 'seo-generator', label: 'SEO Generator', description: 'Artículos optimizados', icon: 'Sparkles', color: 'text-amber-500', bgGradient: 'from-amber-500/20 to-amber-600/10' },
    ],
  },
];

// We store apps config in the same user_sidebar_config table under a separate key in the JSON
export function useAppsConfig() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<AppCategory[]>(DEFAULT_APP_CATEGORIES);
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadConfig();
  }, [user]);

  const loadConfig = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_sidebar_config')
        .select('categories')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.categories) {
        const rawData = data.categories as any;
        const savedApps = rawData.apps as AppCategory[] | undefined;
        if (savedApps && savedApps.length > 0) {
          // Merge new default items
          const allSavedIds = new Set(savedApps.flatMap(c => c.items.map(i => i.id)));
          let hasNew = false;
          const merged = savedApps.map(savedCat => {
            const defaultCat = DEFAULT_APP_CATEGORIES.find(dc => dc.id === savedCat.id);
            if (!defaultCat) return savedCat;
            const newItems = defaultCat.items.filter(di => !allSavedIds.has(di.id));
            if (newItems.length > 0) { hasNew = true; return { ...savedCat, items: [...savedCat.items, ...newItems] }; }
            return savedCat;
          });
          const savedCatIds = new Set(savedApps.map(c => c.id));
          const newCats = DEFAULT_APP_CATEGORIES.filter(dc => !savedCatIds.has(dc.id));
          if (newCats.length > 0) hasNew = true;
          const final = [...merged, ...newCats];
          setCategories(final);
          if (hasNew) saveConfig(final);
        }
      }
    } catch (err) {
      console.error('Error loading apps config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = useCallback(async (newCategories: AppCategory[]) => {
    if (!user) return;
    try {
      // Read existing config first to preserve sidebar data
      const { data: existing } = await supabase
        .from('user_sidebar_config')
        .select('categories')
        .eq('user_id', user.id)
        .maybeSingle();

      const existingData = (existing?.categories as any) || {};
      const merged = { ...existingData, apps: newCategories };

      const { error } = await supabase
        .from('user_sidebar_config')
        .upsert({ user_id: user.id, categories: merged as any }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving apps config:', err);
      toast.error('Error al guardar configuración de apps');
    }
  }, [user]);

  const renameCategory = (categoryId: string, newName: string) => {
    const updated = categories.map(c => c.id === categoryId ? { ...c, label: newName } : c);
    setCategories(updated);
    saveConfig(updated);
  };

  const reorderCategories = (fromIndex: number, toIndex: number) => {
    const updated = [...categories];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setCategories(updated);
    saveConfig(updated);
  };

  const reorderItems = (categoryId: string, fromIndex: number, toIndex: number) => {
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      const items = [...c.items];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return { ...c, items };
    });
    setCategories(updated);
    saveConfig(updated);
  };

  const moveItem = (itemId: string, fromCategoryId: string, toCategoryId: string) => {
    const updated = categories.map(c => ({ ...c, items: [...c.items] }));
    const fromCat = updated.find(c => c.id === fromCategoryId);
    const toCat = updated.find(c => c.id === toCategoryId);
    if (!fromCat || !toCat) return;
    const idx = fromCat.items.findIndex(i => i.id === itemId);
    if (idx < 0) return;
    const [item] = fromCat.items.splice(idx, 1);
    toCat.items.push(item);
    setCategories(updated);
    saveConfig(updated);
  };

  const toggleItemVisibility = (categoryId: string, itemId: string) => {
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      return { ...c, items: c.items.map(i => i.id === itemId ? { ...i, hidden: !i.hidden } : i) };
    });
    setCategories(updated);
    saveConfig(updated);
  };

  const resetToDefault = () => {
    setCategories(DEFAULT_APP_CATEGORIES);
    saveConfig(DEFAULT_APP_CATEGORIES);
    toast.success('Aplicaciones restauradas a valores por defecto');
  };

  return {
    categories,
    editMode,
    setEditMode,
    renameCategory,
    reorderCategories,
    reorderItems,
    moveItem,
    toggleItemVisibility,
    resetToDefault,
    isLoading,
  };
}
