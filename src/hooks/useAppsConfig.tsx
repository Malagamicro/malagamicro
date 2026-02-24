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
  size?: number; // 1=S, 2=M, 3=L, 4=XL — per-item
}

export interface AppCategory {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  items: AppItem[];
}

export interface AppsConfigState {
  categories: AppCategory[];
  defaultSize: number;
}

const DEFAULT_APP_CATEGORIES: AppCategory[] = [
  {
    id: 'comunicacion',
    label: 'Comunicación',
    icon: 'MessagesSquare',
    color: '#3b82f6',
    items: [
      { id: 'inbox', label: 'Inbox', description: 'Notificaciones', icon: 'Inbox', color: 'text-teal-500', bgGradient: 'from-teal-500/20 to-teal-600/10', size: 1 },
      { id: 'correo', label: 'Correo', description: 'Email completo', icon: 'Mail', color: 'text-blue-500', bgGradient: 'from-blue-500/20 to-blue-600/10', size: 1 },
      { id: 'mensajes', label: 'Chat Interno', description: 'Mensajería del equipo', icon: 'MessagesSquare', color: 'text-sky-500', bgGradient: 'from-sky-500/20 to-sky-600/10', size: 1 },
      { id: 'osticket', label: 'Tickets', description: 'Soporte osTicket', icon: 'Ticket', color: 'text-yellow-500', bgGradient: 'from-yellow-500/20 to-yellow-600/10', size: 1 },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'Megaphone',
    color: '#ec4899',
    items: [
      { id: 'campaigns', label: 'Campañas', description: 'Email marketing', icon: 'Megaphone', color: 'text-pink-500', bgGradient: 'from-pink-500/20 to-pink-600/10', size: 1 },
      { id: 'whatsapp', label: 'WhatsApp', description: 'Mensajería directa', icon: 'MessageSquare', color: 'text-green-500', bgGradient: 'from-green-500/20 to-green-600/10', size: 1 },
      { id: 'templates', label: 'Plantillas', description: 'Mensajes predefinidos', icon: 'FileText', color: 'text-amber-500', bgGradient: 'from-amber-500/20 to-amber-600/10', size: 1 },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestión',
    icon: 'Briefcase',
    color: '#10b981',
    items: [
      { id: 'calendario', label: 'Calendario', description: 'Eventos y citas', icon: 'Calendar', color: 'text-blue-500', bgGradient: 'from-blue-500/20 to-blue-600/10', size: 1 },
      { id: 'informes', label: 'Informes', description: 'Reportes detallados', icon: 'BarChart3', color: 'text-emerald-500', bgGradient: 'from-emerald-500/20 to-emerald-600/10', size: 1 },
      { id: 'reminders', label: 'Recordatorios', description: 'Alertas y tareas', icon: 'Bell', color: 'text-rose-400', bgGradient: 'from-rose-500/20 to-rose-600/10', size: 1 },
      { id: 'shared-files', label: 'Archivos', description: 'Almacenamiento compartido', icon: 'Cloud', color: 'text-slate-500', bgGradient: 'from-slate-500/20 to-slate-600/10', size: 1 },
    ],
  },
  {
    id: 'herramientas-ia',
    label: 'Herramientas IA',
    icon: 'Brain',
    color: '#8b5cf6',
    items: [
      { id: 'chat-ai', label: 'Chat IA', description: 'Asistente inteligente', icon: 'Bot', color: 'text-violet-500', bgGradient: 'from-violet-500/20 to-violet-600/10', size: 1 },
      { id: 'editor', label: 'Editor IA', description: 'Documentos con IA', icon: 'FileEdit', color: 'text-emerald-500', bgGradient: 'from-emerald-500/20 to-emerald-600/10', size: 1 },
      { id: 'seo-generator', label: 'SEO Generator', description: 'Artículos optimizados', icon: 'Sparkles', color: 'text-amber-500', bgGradient: 'from-amber-500/20 to-amber-600/10', size: 1 },
    ],
  },
];

export function useAppsConfig() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<AppCategory[]>(DEFAULT_APP_CATEGORIES);
  const [defaultSize, setDefaultSize] = useState(1);
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
        const savedDefaultSize = rawData.appsDefaultSize as number | undefined;
        if (savedDefaultSize) setDefaultSize(savedDefaultSize);
        if (savedApps && savedApps.length > 0) {
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
          if (hasNew) saveConfig(final, savedDefaultSize || 1);
        }
      }
    } catch (err) {
      console.error('Error loading apps config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = useCallback(async (newCategories: AppCategory[], newDefaultSize?: number) => {
    if (!user) return;
    try {
      const { data: existing } = await supabase
        .from('user_sidebar_config')
        .select('categories')
        .eq('user_id', user.id)
        .maybeSingle();

      const existingData = (existing?.categories as any) || {};
      const merged = { ...existingData, apps: newCategories, appsDefaultSize: newDefaultSize ?? defaultSize };

      const { error } = await supabase
        .from('user_sidebar_config')
        .upsert({ user_id: user.id, categories: merged as any }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving apps config:', err);
      toast.error('Error al guardar configuración de apps');
    }
  }, [user, defaultSize]);

  const updateDefaultSize = (size: number) => {
    const clamped = Math.max(1, Math.min(4, size));
    setDefaultSize(clamped);
    saveConfig(categories, clamped);
  };

  const setItemSize = (categoryId: string, itemId: string, size: number) => {
    const clamped = Math.max(1, Math.min(4, size));
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      return { ...c, items: c.items.map(i => i.id === itemId ? { ...i, size: clamped } : i) };
    });
    setCategories(updated);
    saveConfig(updated);
  };

  const setAllItemsSize = (size: number) => {
    const clamped = Math.max(1, Math.min(4, size));
    const updated = categories.map(c => ({
      ...c,
      items: c.items.map(i => ({ ...i, size: clamped })),
    }));
    setCategories(updated);
    setDefaultSize(clamped);
    saveConfig(updated, clamped);
  };

  const renameCategory = (categoryId: string, newName: string) => {
    const updated = categories.map(c => c.id === categoryId ? { ...c, label: newName } : c);
    setCategories(updated);
    saveConfig(updated);
  };

  const setCategoryIcon = (categoryId: string, icon: string) => {
    const updated = categories.map(c => c.id === categoryId ? { ...c, icon } : c);
    setCategories(updated);
    saveConfig(updated);
  };

  const setCategoryColor = (categoryId: string, color: string) => {
    const updated = categories.map(c => c.id === categoryId ? { ...c, color } : c);
    setCategories(updated);
    saveConfig(updated);
  };

  const setItemIcon = (categoryId: string, itemId: string, icon: string) => {
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      return { ...c, items: c.items.map(i => i.id === itemId ? { ...i, icon } : i) };
    });
    setCategories(updated);
    saveConfig(updated);
  };

  const addCategory = (label: string, icon?: string, color?: string) => {
    const id = `custom-${Date.now()}`;
    const newCat: AppCategory = { id, label, icon: icon || 'Folder', color: color || '#6366f1', items: [] };
    const updated = [...categories, newCat];
    setCategories(updated);
    saveConfig(updated);
    return id;
  };

  const deleteCategory = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    const updated = categories.filter(c => c.id !== categoryId);
    if (cat.items.length > 0 && updated.length > 0) {
      updated[0] = { ...updated[0], items: [...updated[0].items, ...cat.items] };
    }
    setCategories(updated);
    saveConfig(updated);
    toast.success('Categoría eliminada');
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
    setDefaultSize(1);
    saveConfig(DEFAULT_APP_CATEGORIES, 1);
    toast.success('Aplicaciones restauradas a valores por defecto');
  };

  const setFullConfig = (newCategories: AppCategory[], newDefaultSize?: number) => {
    setCategories(newCategories);
    if (newDefaultSize) setDefaultSize(newDefaultSize);
    saveConfig(newCategories, newDefaultSize ?? defaultSize);
  };

  return {
    categories,
    defaultSize,
    editMode,
    setEditMode,
    updateDefaultSize,
    setItemSize,
    setAllItemsSize,
    renameCategory,
    setCategoryIcon,
    setCategoryColor,
    setItemIcon,
    addCategory,
    deleteCategory,
    reorderCategories,
    reorderItems,
    moveItem,
    toggleItemVisibility,
    resetToDefault,
    setFullConfig,
    isLoading,
  };
}
