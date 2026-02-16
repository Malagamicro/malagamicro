import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  route?: string;
  showBadge?: boolean;
}

export interface SidebarCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  items: SidebarItem[];
}

const DEFAULT_CATEGORIES: SidebarCategory[] = [
  {
    id: 'main',
    label: 'Principal',
    icon: 'LayoutDashboard',
    color: 'text-blue-500',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', color: 'text-blue-500' },
      { id: 'reports', label: 'Reportes', icon: 'BarChart3', color: 'text-orange-500' },
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
  {
    id: 'marketing',
    label: 'Marketing',
    icon: 'Megaphone',
    color: 'text-pink-500',
    items: [
      { id: 'campaigns', label: 'Campañas Email', icon: 'Mail', color: 'text-pink-500' },
      { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageSquare', color: 'text-green-500' },
      { id: 'templates', label: 'Plantillas', icon: 'FileText', color: 'text-amber-500' },
    ]
  },
  {
    id: 'comunicacion',
    label: 'Comunicación',
    icon: 'MessageCircle',
    color: 'text-teal-500',
    items: [
      { id: 'inbox', label: 'Inbox', icon: 'Inbox', color: 'text-teal-500', showBadge: true },
      { id: 'correo', label: 'Correo', icon: 'Mail', color: 'text-blue-500' },
      { id: 'mensajes', label: 'Chat Interno', icon: 'MessagesSquare', color: 'text-sky-500' },
      { id: 'osticket', label: 'Tickets', icon: 'Ticket', color: 'text-yellow-500' },
    ]
  },
  {
    id: 'gestion',
    label: 'Gestión',
    icon: 'Calculator',
    color: 'text-emerald-500',
    items: [
      { id: 'calendario', label: 'Calendario', icon: 'Calendar', color: 'text-blue-500' },
      { id: 'informes', label: 'Informes', icon: 'FileText', color: 'text-emerald-500' },
      { id: 'reminders', label: 'Recordatorios', icon: 'Bell', color: 'text-rose-400', route: '/reminders' },
      { id: 'shared-files', label: 'Archivos', icon: 'Cloud', color: 'text-slate-400' },
    ]
  },
  {
    id: 'herramientas',
    label: 'Herramientas',
    icon: 'Wrench',
    color: 'text-lime-500',
    items: [
      { id: 'chat-ai', label: 'Chat IA', icon: 'Bot', color: 'text-violet-500' },
      { id: 'editor', label: 'Editor IA', icon: 'FileEdit', color: 'text-emerald-500', route: '/tools/editor' },
      { id: 'seo-generator', label: 'Generador SEO', icon: 'Sparkles', color: 'text-amber-500', route: '/tools/seo' },
      { id: 'scraper', label: 'Scraper', icon: 'Globe', color: 'text-lime-500', route: '/tools/scraper' },
      
    ]
  },
];

export function useSidebarConfig() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<SidebarCategory[]>(DEFAULT_CATEGORIES);
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
        const saved = data.categories as unknown as SidebarCategory[];
        if (saved.length > 0) {
          // Remove deprecated items (e.g. old file manager)
          const deprecatedIds = new Set(['files', 'presupuesto']);
          const cleaned = saved.map(cat => ({
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

  const saveConfig = useCallback(async (newCategories: SidebarCategory[]) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_sidebar_config')
        .upsert({
          user_id: user.id,
          categories: newCategories as any,
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving sidebar config:', err);
      toast.error('Error al guardar la configuración del sidebar');
    }
  }, [user]);

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
    saveConfig(DEFAULT_CATEGORIES);
    toast.success('Sidebar restaurado a valores por defecto');
  };

  return {
    categories,
    isLoading,
    editMode,
    setEditMode,
    addCategory,
    removeCategory,
    renameCategory,
    reorderCategories,
    moveItem,
    reorderItems,
    resetToDefault,
  };
}
