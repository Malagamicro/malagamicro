import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type SidebarPosition = 'left' | 'right' | 'top' | 'bottom';

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  route?: string;
  isExternal?: boolean;
  showBadge?: boolean;
  hidden?: boolean;
}

export interface SidebarCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  bgColor?: string; // Background color for the category section
  items: SidebarItem[];
}

const DEFAULT_CATEGORIES: SidebarCategory[] = [
  {
    id: 'main',
    label: 'Inicio',
    icon: 'LayoutDashboard',
    color: 'text-blue-500',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', color: 'text-blue-500' },
      { id: 'apps', label: 'Aplicaciones', icon: 'LayoutGrid', color: 'text-violet-500' },
    ]
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: 'Briefcase',
    color: 'text-indigo-500',
    items: [
      { id: 'leads', label: 'Leads', icon: 'Users', color: 'text-indigo-500' },
      { id: 'pipeline', label: 'Pipeline', icon: 'Kanban', color: 'text-purple-500' },
      { id: 'prospeccion', label: 'Prospección', icon: 'Search', color: 'text-cyan-500' },
      { id: 'mapa', label: 'Mapa', icon: 'MapPin', color: 'text-red-500' },
    ]
  },
];

export function useSidebarConfig() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<SidebarCategory[]>(DEFAULT_CATEGORIES);
  const [sidebarPosition, setSidebarPositionState] = useState<SidebarPosition>('left');
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
        .from('user_sidebar_config')
        .select('categories')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.categories) {
        const rawData = data.categories as any;
        // Support new format with position
        if (rawData.position) {
          setSidebarPositionState(rawData.position as SidebarPosition);
        }
        const saved = (rawData.items || rawData) as unknown as SidebarCategory[];
        if (saved.length > 0) {
          // Remove deprecated items (moved to Apps hub or old)
          const deprecatedIds = new Set([
            'files', 'presupuesto',
            // Items only in Apps hub
            'inbox', 'correo', 'mensajes', 'osticket',
            'campaigns', 'whatsapp', 'templates',
            'calendario', 'informes', 'reminders', 'shared-files',
            'chat-ai', 'editor', 'seo-generator',
          ]);
          // Also remove deprecated categories
          const deprecatedCatIds = new Set(['marketing', 'comunicacion', 'gestion', 'herramientas', 'captar', 'seguimiento', 'comunicar', 'analizar']);
          const cleaned = saved
            .filter(cat => !deprecatedCatIds.has(cat.id))
            .map(cat => ({
            ...cat,
            items: cat.items.filter(i => !deprecatedIds.has(i.id)),
          }));

          // Merge any new default items that don't exist in saved config
          const allSavedItemIds = new Set(cleaned.flatMap(c => c.items.map(i => i.id)));
          let hasNewItems = false;
          const merged = cleaned.map(savedCat => {
            const defaultCat = DEFAULT_CATEGORIES.find(dc => dc.id === savedCat.id);
            if (!defaultCat) return savedCat;
            const newItems = defaultCat.items.filter(di => !allSavedItemIds.has(di.id));
            if (newItems.length > 0) {
              hasNewItems = true;
              return { ...savedCat, items: [...savedCat.items, ...newItems] };
            }
            return savedCat;
          });
          // Also add entirely new default categories
          const savedCatIds = new Set(cleaned.map(c => c.id));
          const newCats = DEFAULT_CATEGORIES.filter(dc => !savedCatIds.has(dc.id) && dc.items.some(i => !allSavedItemIds.has(i.id)));
          if (newCats.length > 0) hasNewItems = true;
          const final = [...merged, ...newCats];
          setCategories(final);
          // Always save if we cleaned deprecated items or added new ones
          if (hasNewItems || cleaned.some((c, i) => c.items.length !== (saved[i]?.items.length ?? 0))) {
            saveConfig(final);
          }
        }
      }
    } catch (err) {
      console.error('Error loading sidebar config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = useCallback(async (newCategories: SidebarCategory[], position?: SidebarPosition) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_sidebar_config')
        .upsert({
          user_id: user.id,
          categories: { items: newCategories, position: position || sidebarPosition } as any,
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving sidebar config:', err);
      toast.error('Error al guardar la configuración del sidebar');
    }
  }, [user, sidebarPosition]);

  const addCategory = (name: string, icon: string, color: string) => {
    const newCat: SidebarCategory = {
      id: `custom-${Date.now()}`,
      label: name,
      icon,
      color,
      items: [],
    };
    const updated = [...categories, newCat];
    setCategories(updated);
    saveConfig(updated);
  };

  const addLinkItem = (categoryId: string, label: string, url: string, icon: string, color: string) => {
    const newItem: SidebarItem = {
      id: `link-${Date.now()}`,
      label,
      icon,
      color,
      route: url,
      isExternal: true,
    };
    const updated = categories.map(c =>
      c.id === categoryId ? { ...c, items: [...c.items, newItem] } : c
    );
    setCategories(updated);
    saveConfig(updated);
  };

  const removeCategory = (categoryId: string) => {
    const updated = categories.filter(c => c.id !== categoryId);
    setCategories(updated);
    saveConfig(updated);
  };

  const renameCategory = (categoryId: string, newName: string) => {
    const updated = categories.map(c =>
      c.id === categoryId ? { ...c, label: newName } : c
    );
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

  const moveItem = (itemId: string, fromCategoryId: string, toCategoryId: string) => {
    const updated = categories.map(c => ({ ...c, items: [...c.items] }));
    const fromCat = updated.find(c => c.id === fromCategoryId);
    const toCat = updated.find(c => c.id === toCategoryId);
    if (!fromCat || !toCat) return;

    const itemIndex = fromCat.items.findIndex(i => i.id === itemId);
    if (itemIndex < 0) return;

    const [item] = fromCat.items.splice(itemIndex, 1);
    toCat.items.push(item);
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

  const resetToDefault = () => {
    setCategories(DEFAULT_CATEGORIES);
    setSidebarPositionState('left');
    saveConfig(DEFAULT_CATEGORIES, 'left');
    toast.success('Sidebar restaurado a valores por defecto');
  };

  const setSidebarPosition = (position: SidebarPosition) => {
    setSidebarPositionState(position);
    saveConfig(categories, position);
  };

  const setCategoryBgColor = (categoryId: string, bgColor: string | undefined) => {
    const updated = categories.map(c =>
      c.id === categoryId ? { ...c, bgColor } : c
    );
    setCategories(updated);
    saveConfig(updated);
  };

  const toggleItemVisibility = (categoryId: string, itemId: string) => {
    const updated = categories.map(c => {
      if (c.id !== categoryId) return c;
      return {
        ...c,
        items: c.items.map(i =>
          i.id === itemId ? { ...i, hidden: !i.hidden } : i
        ),
      };
    });
    setCategories(updated);
    saveConfig(updated);
  };

  return {
    categories,
    sidebarPosition,
    setSidebarPosition,
    isLoading,
    editMode,
    setEditMode,
    addCategory,
    addLinkItem,
    removeCategory,
    renameCategory,
    reorderCategories,
    moveItem,
    reorderItems,
    resetToDefault,
    setCategoryBgColor,
    toggleItemVisibility,
  };
}
