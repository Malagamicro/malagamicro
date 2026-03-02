import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AppItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;        // icon color — now editable hex
  bgGradient: string;
  hidden?: boolean;
  size?: number;         // 1=S, 2=M, 3=L, 4=XL
  externalUrl?: string;  // if set, opens URL in new tab instead of internal nav
  isCustom?: boolean;    // user-created app
  isFavorite?: boolean;  // pinned to top
  customDescription?: string; // user-editable description
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

// Palette of icon colors for the picker
export const ICON_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#78716c', '#000000',
];

// Convert hex to a tailwind-compatible style color
export function hexToIconStyle(hex: string): string | undefined {
  // If it starts with "text-" it's a legacy tailwind class
  if (hex.startsWith('text-')) return undefined;
  return hex;
}

const DEFAULT_APP_CATEGORIES: AppCategory[] = [
  {
    id: 'captar',
    label: 'Conseguir clientes',
    icon: 'Search',
    color: '#06b6d4',
    items: [
      { id: 'correo', label: 'Correo', description: 'Email profesional', icon: 'Mail', color: '#3b82f6', bgGradient: 'from-blue-500/20 to-blue-600/10', size: 1 },
      { id: 'whatsapp', label: 'WhatsApp', description: 'Mensajería directa', icon: 'MessageSquare', color: '#22c55e', bgGradient: 'from-green-500/20 to-green-600/10', size: 1 },
      { id: 'campaigns', label: 'Campañas', description: 'Email marketing', icon: 'Megaphone', color: '#ec4899', bgGradient: 'from-pink-500/20 to-pink-600/10', size: 1 },
      { id: 'templates', label: 'Plantillas', description: 'Mensajes predefinidos', icon: 'FileText', color: '#f59e0b', bgGradient: 'from-amber-500/20 to-amber-600/10', size: 1 },
      { id: 'seo-generator', label: 'SEO Generator', description: 'Artículos optimizados', icon: 'Sparkles', color: '#f59e0b', bgGradient: 'from-amber-500/20 to-amber-600/10', size: 1 },
    ],
  },
  {
    id: 'seguimiento',
    label: 'Hacer seguimiento',
    icon: 'Kanban',
    color: '#8b5cf6',
    items: [
      { id: 'calendario', label: 'Calendario', description: 'Eventos y citas', icon: 'Calendar', color: '#3b82f6', bgGradient: 'from-blue-500/20 to-blue-600/10', size: 1 },
      { id: 'reminders', label: 'Recordatorios', description: 'Alertas y tareas', icon: 'Bell', color: '#f43f5e', bgGradient: 'from-rose-500/20 to-rose-600/10', size: 1 },
      { id: 'osticket', label: 'Tickets', description: 'Soporte osTicket', icon: 'Ticket', color: '#eab308', bgGradient: 'from-yellow-500/20 to-yellow-600/10', size: 1 },
      { id: 'informes', label: 'Informes', description: 'Reportes detallados', icon: 'BarChart3', color: '#10b981', bgGradient: 'from-emerald-500/20 to-emerald-600/10', size: 1 },
    ],
  },
  {
    id: 'comunicar',
    label: 'Comunicación interna',
    icon: 'MessagesSquare',
    color: '#0ea5e9',
    items: [
      { id: 'mensajes', label: 'Chat Interno', description: 'Mensajería del equipo', icon: 'MessagesSquare', color: '#0ea5e9', bgGradient: 'from-sky-500/20 to-sky-600/10', size: 1 },
      { id: 'inbox', label: 'Inbox', description: 'Notificaciones', icon: 'Inbox', color: '#14b8a6', bgGradient: 'from-teal-500/20 to-teal-600/10', size: 1 },
      { id: 'shared-files', label: 'Archivos', description: 'Almacenamiento compartido', icon: 'Cloud', color: '#64748b', bgGradient: 'from-slate-500/20 to-slate-600/10', size: 1 },
    ],
  },
  {
    id: 'herramientas-ia',
    label: 'Herramientas IA',
    icon: 'Brain',
    color: '#8b5cf6',
    items: [
      { id: 'chat-ai', label: 'Chat IA', description: 'Asistente inteligente', icon: 'Bot', color: '#8b5cf6', bgGradient: 'from-violet-500/20 to-violet-600/10', size: 1 },
      { id: 'editor', label: 'Editor IA', description: 'Documentos con IA', icon: 'FileEdit', color: '#10b981', bgGradient: 'from-emerald-500/20 to-emerald-600/10', size: 1 },
    ],
  },
  {
    id: 'administracion',
    label: 'Administración',
    icon: 'Shield',
    color: '#ef4444',
    items: [
      { id: 'rendimiento', label: 'Rendimiento', description: 'Métricas y logs del sistema', icon: 'Activity', color: '#ef4444', bgGradient: 'from-red-500/20 to-red-600/10', size: 1 },
      { id: 'seguridad', label: 'Seguridad', description: 'Bloqueos y auditoría de accesos', icon: 'ShieldAlert', color: '#f43f5e', bgGradient: 'from-rose-500/20 to-rose-600/10', size: 1 },
      { id: 'ai-memory', label: 'Memoria IA', description: 'Gestionar contexto y recuerdos de Micro', icon: 'Brain', color: '#8b5cf6', bgGradient: 'from-violet-500/20 to-violet-600/10', size: 1 },
      { id: 'settings', label: 'Ajustes', description: 'Configuración general', icon: 'Settings', color: '#64748b', bgGradient: 'from-slate-500/20 to-slate-600/10', size: 1 },
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

  const setItemColor = (categoryId: string, itemId: string, color: string) => {
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      return { ...c, items: c.items.map(i => i.id === itemId ? { ...i, color } : i) };
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

  const addCustomApp = (categoryId: string, label: string, url: string, icon?: string, color?: string) => {
    const id = `custom-app-${Date.now()}`;
    const newApp: AppItem = {
      id,
      label,
      description: url,
      icon: icon || 'Globe',
      color: color || '#3b82f6',
      bgGradient: 'from-primary/10 to-primary/5',
      size: 1,
      externalUrl: url,
      isCustom: true,
    };
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      return { ...c, items: [...c.items, newApp] };
    });
    setCategories(updated);
    saveConfig(updated);
    toast.success(`App "${label}" añadida`);
    return id;
  };

  const deleteItem = (categoryId: string, itemId: string) => {
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      return { ...c, items: c.items.filter(i => i.id !== itemId) };
    });
    setCategories(updated);
    saveConfig(updated);
    toast.success('App eliminada');
  };

  const updateItem = (categoryId: string, itemId: string, updates: Partial<AppItem>) => {
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      return { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...updates } : i) };
    });
    setCategories(updated);
    saveConfig(updated);
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

  const toggleFavorite = (categoryId: string, itemId: string) => {
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      return { ...c, items: c.items.map(i => i.id === itemId ? { ...i, isFavorite: !i.isFavorite } : i) };
    });
    setCategories(updated);
    saveConfig(updated);
  };

  const updateItemDescription = (categoryId: string, itemId: string, desc: string) => {
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      return { ...c, items: c.items.map(i => i.id === itemId ? { ...i, customDescription: desc } : i) };
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
    setItemColor,
    addCategory,
    addCustomApp,
    deleteItem,
    updateItem,
    deleteCategory,
    reorderCategories,
    reorderItems,
    moveItem,
    toggleItemVisibility,
    toggleFavorite,
    updateItemDescription,
    resetToDefault,
    setFullConfig,
    isLoading,
  };
}
