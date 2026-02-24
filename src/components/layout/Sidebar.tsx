import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, Users, Search, Mail, MessageSquare, MessagesSquare,
  MapPin, Settings, LogOut, Kanban, BarChart3, Sun, Moon, Inbox,
  FileText, Globe, Ticket, FolderOpen, Bot, Cloud, Calculator,
  Menu, X, Bell, Megaphone, Briefcase, Wrench, MessageCircle,
  ChevronDown, PanelLeftClose, PanelLeft, Sparkles, Pencil,
  GripVertical, Plus, RotateCcw, Trash2, FolderPlus, Check,
  Calendar as CalendarIcon, Palette, Eye, EyeOff,
  PanelLeft as PanelLeftIcon, PanelRight, PanelTop, PanelBottom,
  ExternalLink, Link, FileEdit, LayoutGrid,
} from 'lucide-react';
import { ThemeCustomizer } from '@/components/layout/ThemeCustomizer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSidebarConfig, SidebarCategory, SidebarItem, SidebarPosition } from '@/hooks/useSidebarConfig';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import logoFull from '@/assets/logo-full.png';
import logoIcon from '@/assets/logo-icon.png';

const APP_VERSION = 'v2.8.6';
const APP_BUILD_DATE = '2026-02-18 14:00';

interface OpenTab {
  id: string;
  label: string;
  icon: string;
  color: string;
}

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  position?: SidebarPosition;
  onPositionChange?: (position: SidebarPosition) => void;
  openTabs?: OpenTab[];
  onCloseTab?: (tabId: string) => void;
}

// Icon registry
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Search, Mail, MessageSquare, MessagesSquare,
  MapPin, Settings, Kanban, BarChart3, Inbox, FileText, Globe,
  Ticket, FolderOpen, Bot, Cloud, Calculator, Bell, Megaphone,
  Briefcase, Wrench, MessageCircle, Sparkles, FolderPlus, Calendar: CalendarIcon,
  ExternalLink, Link, FileEdit, LayoutGrid,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_OPTIONS = [
  'text-blue-500', 'text-indigo-500', 'text-purple-500', 'text-pink-500',
  'text-red-500', 'text-orange-500', 'text-amber-500', 'text-yellow-500',
  'text-lime-500', 'text-green-500', 'text-emerald-500', 'text-teal-500',
  'text-cyan-500', 'text-sky-500', 'text-violet-500', 'text-rose-500',
  'text-slate-400',
];

const BG_COLOR_OPTIONS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#64748b', '#78716c',
];

function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] || LayoutDashboard;
}

// Custom Toggle Switch Component
function SidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "group relative flex items-center justify-center w-full h-10 rounded-xl",
        "bg-sidebar-accent/50 hover:bg-sidebar-accent transition-all duration-300",
        "border border-sidebar-border/50"
      )}
      aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
    >
      <div className="relative flex items-center gap-2">
        {collapsed ? (
          <PanelLeft className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
        ) : (
          <>
            <PanelLeftClose className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-xs font-medium opacity-70">Colapsar</span>
          </>
        )}
      </div>
      <div className={cn(
        "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary rounded-full transition-all duration-300",
        collapsed ? "w-4" : "w-12"
      )} />
    </button>
  );
}

// Collapsed Icon Button with Tooltip
function CollapsedIconButton({ item, isActive, onClick, unreadCount }: { 
  item: SidebarItem; isActive: boolean; onClick: () => void; unreadCount?: number;
}) {
  const Icon = getIcon(item.icon);
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200",
              "hover:bg-sidebar-accent hover:scale-105",
              isActive && "bg-primary/15 shadow-sm ring-2 ring-primary/30"
            )}>
            <Icon className={cn("w-5 h-5", isActive ? "text-primary" : item.color)} />
            {item.showBadge && unreadCount && unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Add Category Dialog
function AddCategoryDialog({ onAdd }: { onAdd: (name: string, icon: string, color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('FolderPlus');
  const [color, setColor] = useState('text-blue-500');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), icon, color);
    setName('');
    setIcon('FolderPlus');
    setColor('text-blue-500');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors">
          <Plus className="w-4 h-4" />
          <span>Nueva carpeta</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[360px] bg-background">
        <DialogHeader><DialogTitle>Nueva carpeta</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la carpeta" />
          <div>
            <label className="text-sm font-medium mb-2 block">Icono</label>
            <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto p-1">
              {ICON_OPTIONS.map(ic => {
                const Ic = ICON_MAP[ic];
                return (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={cn("w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                      icon === ic ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    <Ic className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Color</label>
            <div className="grid grid-cols-8 gap-1.5">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn("w-8 h-8 rounded-full transition-all", c.replace('text-', 'bg-'),
                    color === c ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
                  )}
                />
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={handleAdd} disabled={!name.trim()}>
            <Check className="w-4 h-4 mr-2" /> Crear carpeta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add External Link Dialog
function AddLinkDialog({ categories, onAdd }: {
  categories: SidebarCategory[];
  onAdd: (categoryId: string, label: string, url: string, icon: string, color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('ExternalLink');
  const [color, setColor] = useState('text-blue-500');
  const [categoryId, setCategoryId] = useState('');

  const handleAdd = () => {
    if (!label.trim() || !url.trim() || !categoryId) return;
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
    onAdd(categoryId, label.trim(), finalUrl, icon, color);
    setLabel('');
    setUrl('');
    setIcon('ExternalLink');
    setColor('text-blue-500');
    setCategoryId('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors">
          <Link className="w-4 h-4" />
          <span>Añadir enlace externo</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px] bg-background">
        <DialogHeader><DialogTitle>Añadir enlace externo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Carpeta destino</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una carpeta..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nombre del enlace</label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Google, Panel de control..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">URL de destino</label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://ejemplo.com" />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Icono</label>
            <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto p-1">
              {['ExternalLink', 'Link', 'Globe', 'Briefcase', 'FileText', 'MessageSquare', 'Mail', 'Bot', 'Sparkles', 'Cloud', 'Settings', 'Calculator', 'Bell', 'Search', 'Wrench', 'FolderOpen'].map(ic => {
                const Ic = ICON_MAP[ic] || ExternalLink;
                return (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={cn("w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                      icon === ic ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    <Ic className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Color</label>
            <div className="grid grid-cols-8 gap-1.5">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn("w-8 h-8 rounded-full transition-all", c.replace('text-', 'bg-'),
                    color === c ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
                  )}
                />
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            onClick={handleAdd}
            disabled={!label.trim() || !url.trim() || !categoryId}
          >
            <ExternalLink className="w-4 h-4 mr-2" /> Añadir enlace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Sidebar({ activeTab, onTabChange, position = 'left', onPositionChange, openTabs = [], onCloseTab }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(['main', 'crm', '__open_tabs']);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { unreadCount } = useNotificationContext();
  const isMobile = useIsMobile();
  const {
    categories, editMode, setEditMode, addCategory, addLinkItem, removeCategory,
    renameCategory, reorderCategories, moveItem, reorderItems, resetToDefault,
    sidebarPosition, setSidebarPosition, setCategoryBgColor, toggleItemVisibility,
  } = useSidebarConfig();

  useEffect(() => {
    const categoryWithActiveTab = categories.find(cat =>
      cat.items.some(item => item.id === activeTab)
    );
    if (categoryWithActiveTab && !openCategories.includes(categoryWithActiveTab.id)) {
      setOpenCategories(prev => [...prev, categoryWithActiveTab.id]);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [activeTab, isMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sidebar]') && !target.closest('[data-sidebar-trigger]')) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mobileOpen]);

  const handleSignOut = async () => { await signOut(); };
  const toggleTheme = () => { setTheme(theme === 'dark' ? 'light' : 'dark'); };
  const handleTabChange = (tab: string) => { onTabChange(tab); if (isMobile) setMobileOpen(false); };
  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };
  const handleItemClick = (item: SidebarItem) => {
    if (item.isExternal && item.route) {
      window.open(item.route, '_blank', 'noopener,noreferrer');
      if (isMobile) setMobileOpen(false);
    } else if (item.route) {
      navigate(item.route);
      if (isMobile) setMobileOpen(false);
    } else {
      handleTabChange(item.id);
    }
  };

  const handleAddLink = (categoryId: string, label: string, url: string, icon: string, color: string) => {
    addLinkItem(categoryId, label, url, icon, color);
  };

  const handleStartRename = (catId: string, currentName: string) => {
    setRenamingCategory(catId);
    setRenameValue(currentName);
  };

  const handleFinishRename = (catId: string) => {
    if (renameValue.trim()) renameCategory(catId, renameValue.trim());
    setRenamingCategory(null);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, type } = result;

    if (type === 'CATEGORY') {
      reorderCategories(source.index, destination.index);
      return;
    }

    // Item drag within same category
    if (source.droppableId === destination.droppableId) {
      reorderItems(source.droppableId, source.index, destination.index);
    } else {
      // Move item between categories
      const fromCat = categories.find(c => c.id === source.droppableId);
      if (!fromCat) return;
      const item = fromCat.items[source.index];
      if (!item) return;
      moveItem(item.id, source.droppableId, destination.droppableId);
    }
  };

  const renderMenuItem = (item: SidebarItem) => {
    const isActive = activeTab === item.id;
    const Icon = getIcon(item.icon);

    return (
      <button
        key={item.id}
        onClick={() => handleItemClick(item)}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-1 rounded-md transition-all duration-200 relative min-h-[30px]",
          isMobile && "gap-1.5 px-2 py-0.5 min-h-[26px]",
          "hover:bg-sidebar-accent",
          isActive && "bg-primary/15 border-l-2 border-primary font-semibold shadow-sm",
          !isActive && "border-l-2 border-transparent"
        )}
      >
        <div className="relative">
          <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", isMobile && "w-3 h-3", isActive ? "text-primary" : item.color)} />
        </div>
        <span className={cn("text-[11px] animate-fade-in flex-1 text-left", isMobile && "text-[10px]", isActive && "text-primary font-semibold")}>{item.label}</span>
        {item.isExternal && (
          <ExternalLink className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
        )}
        {item.showBadge && unreadCount > 0 && (
          <Badge variant="destructive" className={cn("h-5 min-w-[20px] flex items-center justify-center text-xs px-1.5", isMobile && "h-4 min-w-[16px] text-[10px] px-1")}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </button>
    );
  };

  const renderCollapsedCategory = (category: SidebarCategory) => {
    const visibleItems = category.items.filter(i => !i.hidden);
    if (visibleItems.length === 0) return null;
    return (
      <div key={category.id} className="space-y-1">
        <div className="flex justify-center py-1">
          <div className={cn("w-1.5 h-1.5 rounded-full", category.color.replace('text-', 'bg-'))} />
        </div>
        <div className="space-y-1 px-1">
          {visibleItems.map(item => (
            <CollapsedIconButton
              key={item.id}
              item={item}
              isActive={activeTab === item.id}
              onClick={() => handleItemClick(item)}
              unreadCount={item.showBadge ? unreadCount : undefined}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderExpandedCategory = (category: SidebarCategory, index?: number) => {
    const visibleItems = category.items.filter(i => !i.hidden);
    // In normal mode, skip categories with no visible items
    if (!editMode && visibleItems.length === 0) return null;
    const isOpen = openCategories.includes(category.id);
    const hasActiveItem = visibleItems.some(item => item.id === activeTab);
    const CatIcon = getIcon(category.icon);

    return (
      <div
        key={category.id}
        className="rounded-lg transition-all"
        style={category.bgColor ? { backgroundColor: category.bgColor, opacity: 1, backgroundBlendMode: 'normal' } : undefined}
        data-has-bg={!!category.bgColor}
      >
      <Collapsible open={isOpen} onOpenChange={() => toggleCategory(category.id)}>
        <div className="flex items-center group">
          <CollapsibleTrigger asChild>
            <button className={cn(
              "flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-200",
              isMobile && "gap-1.5 px-2 py-1",
              "hover:bg-sidebar-accent/50", hasActiveItem && "bg-sidebar-accent/30"
            )}>
              <CatIcon className={cn("w-4 h-4 flex-shrink-0", isMobile && "w-3.5 h-3.5", category.color)} />
              {renamingCategory === category.id ? (
                <Input
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => handleFinishRename(category.id)}
                  onKeyDown={e => e.key === 'Enter' && handleFinishRename(category.id)}
                  className="h-5 text-xs py-0"
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className={cn("text-sm font-bold uppercase tracking-wide flex-1 text-left", isMobile && "text-xs")}>{category.label}</span>
              )}
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isMobile && "w-3 h-3", isOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
           {editMode && (
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
              {/* Background color picker */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded hover:bg-sidebar-accent"
                  >
                    <Palette className="w-3 h-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="p-2">
                  <div className="grid grid-cols-6 gap-1">
                    <button
                      onClick={() => setCategoryBgColor(category.id, undefined)}
                      className={cn("w-6 h-6 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px]",
                        !category.bgColor && "ring-2 ring-primary"
                      )}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {BG_COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => setCategoryBgColor(category.id, c)}
                        className={cn("w-6 h-6 rounded transition-all",
                          category.bgColor === c ? "ring-2 ring-primary scale-110" : "hover:scale-110"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={(e) => { e.stopPropagation(); handleStartRename(category.id, category.label); }}
                className="p-1 rounded hover:bg-sidebar-accent"
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removeCategory(category.id); }}
                className="p-1 rounded hover:bg-destructive/20"
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </div>
          )}
        </div>
        <CollapsibleContent className="pl-3 space-y-0.5 mt-1 animate-accordion-down">
          {editMode ? (
            <Droppable droppableId={category.id} type="ITEM">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0.5 min-h-[8px]">
                  {category.items.map((item, idx) => (
                    <Draggable key={item.id} draggableId={`item-${item.id}`} index={idx}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(snapshot.isDragging && "opacity-70 shadow-lg")}
                        >
                          <div className="flex items-center">
                            <div {...provided.dragHandleProps} className="p-1 cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <div className={cn("flex-1", item.hidden && "opacity-40")}>{renderMenuItem(item)}</div>
                            <button
                              onClick={() => toggleItemVisibility(category.id, item.id)}
                              className="p-1 rounded hover:bg-sidebar-accent flex-shrink-0"
                              title={item.hidden ? 'Mostrar' : 'Ocultar'}
                            >
                              {item.hidden
                                ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                                : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ) : (
            category.items.filter(i => !i.hidden).map(renderMenuItem)
          )}
        </CollapsibleContent>
      </Collapsible>
      </div>
    );
  };

  // Edit mode toggle button
  const editToggle = (
    <button
      onClick={() => setEditMode(!editMode)}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
        editMode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-sidebar-accent"
      )}
    >
      <Pencil className="w-4 h-4" />
      <span>{editMode ? 'Terminar edición' : 'Editar sidebar'}</span>
    </button>
  );

  // Collapsed sidebar content
  const collapsedContent = (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-sidebar-border flex flex-col items-center gap-1">
        <span className="text-[8px] font-mono text-muted-foreground/60 leading-none">{APP_VERSION}</span>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { onTabChange('dashboard'); }}
                className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
              >
                <img src={logoIcon} alt="MalagaMicro" className="w-9 h-9 object-contain" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right"><p className="font-bold">Ir al Dashboard</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto custom-scrollbar">
        <div className="space-y-3 flex flex-col items-center">
          {categories.map(renderCollapsedCategory)}
        </div>
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-1">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={toggleTheme} className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl hover:bg-sidebar-accent transition-all duration-200 hover:scale-105">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <CollapsedIconButton
          item={{ id: 'settings', label: 'Ajustes', icon: 'Settings', color: '' }}
          isActive={activeTab === 'settings'}
          onClick={() => handleTabChange('settings')}
        />
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleSignOut} className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl hover:bg-sidebar-accent transition-all duration-200 text-destructive hover:scale-105">
                <LogOut className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Cerrar sesión</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="pt-2">
          <SidebarToggle collapsed={collapsed} onToggle={() => setCollapsed(false)} />
        </div>
      </div>
    </div>
  );

  // Expanded sidebar content with DnD in edit mode
  const expandedNavContent = editMode ? (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="sidebar-categories" type="CATEGORY">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
            {categories.map((cat, index) => (
              <Draggable key={cat.id} draggableId={`cat-${cat.id}`} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(snapshot.isDragging && "opacity-70 shadow-lg")}
                  >
                    <div className="flex items-start">
                      <div {...provided.dragHandleProps} className="pt-3 px-1 cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">{renderExpandedCategory(cat, index)}</div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <AddCategoryDialog onAdd={addCategory} />
      <AddLinkDialog categories={categories} onAdd={handleAddLink} />
      {/* Position selector */}
      <div className="px-3 py-2">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Posición del sidebar</label>
        <div className="grid grid-cols-4 gap-1">
          {([
            { pos: 'left' as SidebarPosition, icon: PanelLeftIcon, label: 'Izq' },
            { pos: 'right' as SidebarPosition, icon: PanelRight, label: 'Der' },
            { pos: 'top' as SidebarPosition, icon: PanelTop, label: 'Arriba' },
            { pos: 'bottom' as SidebarPosition, icon: PanelBottom, label: 'Abajo' },
          ]).map(({ pos, icon: Icon, label }) => (
            <button
              key={pos}
              onClick={() => { setSidebarPosition(pos); onPositionChange?.(pos); }}
              className={cn(
                "flex flex-col items-center gap-0.5 p-1.5 rounded-md text-[10px] transition-colors",
                sidebarPosition === pos
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-sidebar-accent text-muted-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={resetToDefault}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        <span>Restaurar por defecto</span>
      </button>
    </DragDropContext>
  ) : (
    categories.map(renderExpandedCategory)
  );

  const expandedContent = (
    <>
      <div className="p-4 border-b border-sidebar-border">
        <div className="text-[9px] font-mono text-muted-foreground/60 mb-1">{APP_VERSION} · {APP_BUILD_DATE}</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { onTabChange('dashboard'); }}
              className="h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white px-2 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            >
              <img src={logoFull} alt="MalagaMicro CRM" className="h-8 object-contain" />
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Open Tabs Section - Collapsible */}
      {openTabs.length > 0 && (
        <div className="px-3 pt-2 pb-1 border-b border-sidebar-border/50">
          <Collapsible open={openCategories.includes('__open_tabs')} onOpenChange={() => toggleCategory('__open_tabs')}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between mb-1 hover:bg-sidebar-accent/50 rounded px-1 py-0.5 transition-colors">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Abiertas</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground/50">{openTabs.length}</span>
                  <ChevronDown className={cn("w-3 h-3 text-muted-foreground/50 transition-transform duration-200", openCategories.includes('__open_tabs') && "rotate-180")} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="animate-accordion-down">
              <div className="space-y-0.5 max-h-[180px] overflow-y-auto custom-scrollbar">
                {openTabs.map(tab => {
                  const TabIcon = getIcon(tab.icon);
                  const isActive2 = activeTab === tab.id;
                  return (
                    <div
                      key={tab.id}
                      className={cn(
                        "group flex items-center gap-2 px-2 py-1 rounded-md transition-all cursor-pointer text-xs",
                        isActive2 ? "bg-primary/15 text-primary font-semibold" : "hover:bg-sidebar-accent text-sidebar-foreground/80"
                      )}
                      onClick={() => onTabChange(tab.id)}
                    >
                      <TabIcon className={cn("w-3 h-3 shrink-0", isActive2 ? "text-primary" : tab.color)} />
                      <span className="flex-1 truncate">{tab.label}</span>
                      {onCloseTab && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 transition-all shrink-0"
                        >
                          <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {expandedNavContent}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <ThemeCustomizer />
        {editToggle}
        {user && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">{user.email}</div>
        )}
        <button
          onClick={() => handleTabChange('settings')}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all min-h-[32px]",
            "hover:bg-sidebar-accent",
            activeTab === 'settings' ? "bg-primary/15 border-l-2 border-primary text-primary font-semibold" : "border-l-2 border-transparent"
          )}
        >
          <Settings className={cn("w-4 h-4 flex-shrink-0", activeTab === 'settings' && "text-primary")} />
          <span className="text-xs font-medium">Ajustes</span>
        </button>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all min-h-[32px] hover:bg-sidebar-accent text-destructive hover:text-destructive/80"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium">Cerrar sesión</span>
        </button>
        <SidebarToggle collapsed={collapsed} onToggle={() => setCollapsed(true)} />
      </div>
    </>
  );

  // Mobile content
  const mobileContent = (
    <>
      <div className="p-2.5 border-b border-sidebar-border">
        <div className="text-[8px] font-mono text-muted-foreground/60 mb-0.5">{APP_VERSION} · {APP_BUILD_DATE}</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onTabChange('dashboard'); if (isMobile) setMobileOpen(false); }}
              className="h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white px-1.5 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            >
              <img src={logoFull} alt="MalagaMicro CRM" className="h-6 object-contain" />
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent">
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {editMode ? expandedNavContent : categories.map(renderExpandedCategory)}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        <ThemeCustomizer />
        {editToggle}
        {user && (
          <div className="px-2 py-1 text-[10px] text-sidebar-foreground/70 truncate">{user.email}</div>
        )}
        <button
          onClick={() => handleTabChange('settings')}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all min-h-[32px]",
            "hover:bg-sidebar-accent", activeTab === 'settings' && "bg-sidebar-accent"
          )}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium">Ajustes</span>
        </button>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all min-h-[32px] hover:bg-sidebar-accent text-destructive hover:text-destructive/80"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium">Cerrar sesión</span>
        </button>
      </div>
    </>
  );

  // Horizontal sidebar content (top/bottom) with category popovers
  const horizontalContent = (
    <div className="flex items-center h-full w-full px-3 gap-1.5">
      <button
        onClick={() => onTabChange('dashboard')}
        className="h-9 rounded-lg overflow-hidden flex items-center justify-center bg-white px-2 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all flex-shrink-0"
      >
        <img src={logoFull} alt="MalagaMicro CRM" className="h-7 object-contain" />
      </button>
      <div className="h-6 w-px bg-sidebar-border mx-1 flex-shrink-0" />
      <nav className="flex items-center gap-0.5 overflow-x-auto flex-1 scrollbar-none">
        {categories.map(cat => {
          const visibleItems = cat.items.filter(i => !i.hidden);
          if (visibleItems.length === 0) return null;
          const CatIcon = getIcon(cat.icon);
          const hasActiveItem = visibleItems.some(item => item.id === activeTab);
          return (
            <DropdownMenu key={cat.id}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-semibold uppercase tracking-wide whitespace-nowrap flex-shrink-0",
                    "hover:bg-sidebar-accent",
                    hasActiveItem && "bg-primary/15 text-primary border-b-2 border-primary"
                  )}
                >
                  <CatIcon className={cn("w-4 h-4", hasActiveItem ? "text-primary" : cat.color)} />
                  <span>{cat.label}</span>
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side={position === 'top' ? 'bottom' : 'top'}
                sideOffset={4}
                className="min-w-[180px] p-1.5"
              >
                {visibleItems.map(item => {
                  const isActive = activeTab === item.id;
                  const Icon = getIcon(item.icon);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all text-sm",
                        "hover:bg-sidebar-accent",
                        isActive && "bg-primary/15 text-primary font-semibold"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary" : item.color)} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.isExternal && <ExternalLink className="w-3 h-3 text-muted-foreground/50" />}
                      {item.showBadge && unreadCount > 0 && (
                        <Badge variant="destructive" className="h-4 min-w-[16px] text-[10px] px-1">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </nav>
      <div className="h-6 w-px bg-sidebar-border mx-1 flex-shrink-0" />
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors">
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <ThemeCustomizer />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("w-8 h-8 flex items-center justify-center rounded-lg transition-colors", editMode ? "bg-primary/10 text-primary" : "hover:bg-sidebar-accent")}>
              <Pencil className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side={position === 'top' ? 'bottom' : 'top'} className="w-72 p-3 space-y-3" sideOffset={8}>
            <h3 className="font-semibold text-sm">Personalizar Sidebar</h3>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Posición</label>
              <div className="grid grid-cols-4 gap-1">
                {([
                  { pos: 'left' as SidebarPosition, icon: PanelLeftIcon, label: 'Izq' },
                  { pos: 'right' as SidebarPosition, icon: PanelRight, label: 'Der' },
                  { pos: 'top' as SidebarPosition, icon: PanelTop, label: 'Arriba' },
                  { pos: 'bottom' as SidebarPosition, icon: PanelBottom, label: 'Abajo' },
                ]).map(({ pos, icon: Icon, label }) => (
                  <button
                    key={pos}
                    onClick={() => { setSidebarPosition(pos); onPositionChange?.(pos); }}
                    className={cn(
                      "flex flex-col items-center gap-0.5 p-1.5 rounded-md text-[10px] transition-colors",
                      sidebarPosition === pos
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-sidebar-accent text-muted-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setEditMode(!editMode)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                editMode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-sidebar-accent"
              )}
            >
              <Pencil className="w-4 h-4" />
              <span>{editMode ? 'Terminar edición' : 'Editar elementos'}</span>
            </button>
            <button onClick={resetToDefault} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent">
              <RotateCcw className="w-4 h-4" /> Restaurar por defecto
            </button>
          </DropdownMenuContent>
        </DropdownMenu>
        <button onClick={() => handleTabChange('settings')} className={cn("w-8 h-8 flex items-center justify-center rounded-lg transition-colors", activeTab === 'settings' && "bg-sidebar-accent")}>
          <Settings className="w-4 h-4" />
        </button>
        <button onClick={handleSignOut} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sidebar-accent text-destructive">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isMobile && (
        <Button data-sidebar-trigger variant="ghost" size="icon" onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-40 h-11 w-11 bg-background/80 backdrop-blur-sm border shadow-sm"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {isMobile && mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        data-sidebar
        className={cn(
          "bg-sidebar text-sidebar-foreground transition-all duration-300 flex",
          // Vertical sidebar (left/right)
          (position === 'left' || position === 'right') && "flex-col",
          (position === 'left' || position === 'right') && !isMobile && "h-screen",
          (position === 'left' || position === 'right') && !isMobile && (collapsed ? "w-[60px]" : "w-64"),
          // Horizontal sidebar (top/bottom)
          (position === 'top' || position === 'bottom') && !isMobile && "w-full flex-row items-center h-12 overflow-hidden",
          // Mobile always left
          isMobile && "fixed inset-y-0 left-0 z-50 w-60 flex-col",
          isMobile && (mobileOpen ? "translate-x-0" : "-translate-x-full")
        )}
      >
        {isMobile
          ? mobileContent
          : (position === 'top' || position === 'bottom')
            ? horizontalContent
            : (collapsed ? collapsedContent : expandedContent)
        }
      </aside>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--sidebar-border)); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--sidebar-foreground) / 0.3); }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  );
}
