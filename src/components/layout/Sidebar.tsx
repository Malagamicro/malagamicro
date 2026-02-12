import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, Users, Search, Mail, MessageSquare, MessagesSquare,
  MapPin, Settings, LogOut, Kanban, BarChart3, Sun, Moon, Inbox,
  FileText, Globe, Ticket, FolderOpen, Bot, Cloud, Calculator,
  Menu, X, Bell, Megaphone, Briefcase, Wrench, MessageCircle,
  ChevronDown, PanelLeftClose, PanelLeft, Sparkles, Pencil,
  GripVertical, Plus, RotateCcw, Trash2, FolderPlus, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSidebarConfig, SidebarCategory, SidebarItem } from '@/hooks/useSidebarConfig';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import logoFull from '@/assets/logo-full.png';
import logoIcon from '@/assets/logo-icon.png';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Icon registry
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Search, Mail, MessageSquare, MessagesSquare,
  MapPin, Settings, Kanban, BarChart3, Inbox, FileText, Globe,
  Ticket, FolderOpen, Bot, Cloud, Calculator, Bell, Megaphone,
  Briefcase, Wrench, MessageCircle, Sparkles, FolderPlus,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_OPTIONS = [
  'text-blue-500', 'text-indigo-500', 'text-purple-500', 'text-pink-500',
  'text-red-500', 'text-orange-500', 'text-amber-500', 'text-yellow-500',
  'text-lime-500', 'text-green-500', 'text-emerald-500', 'text-teal-500',
  'text-cyan-500', 'text-sky-500', 'text-violet-500', 'text-rose-500',
  'text-slate-400',
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
              isActive && "bg-sidebar-accent shadow-sm ring-1 ring-primary/20"
            )}
          >
            <Icon className={cn("w-5 h-5", item.color)} />
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

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(['main', 'crm', 'marketing']);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { unreadCount } = useNotificationContext();
  const isMobile = useIsMobile();
  const {
    categories, editMode, setEditMode, addCategory, removeCategory,
    renameCategory, reorderCategories, moveItem, reorderItems, resetToDefault,
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
    if (item.route) { navigate(item.route); if (isMobile) setMobileOpen(false); }
    else { handleTabChange(item.id); }
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
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 relative min-h-[40px]",
          isMobile && "gap-2 px-2 py-1.5 min-h-[32px]",
          "hover:bg-sidebar-accent",
          isActive && "bg-sidebar-accent"
        )}
      >
        <div className="relative">
          <Icon className={cn("w-4 h-4 flex-shrink-0", isMobile && "w-3.5 h-3.5", item.color)} />
        </div>
        <span className={cn("text-sm font-medium animate-fade-in flex-1 text-left", isMobile && "text-xs")}>{item.label}</span>
        {item.showBadge && unreadCount > 0 && (
          <Badge variant="destructive" className={cn("h-5 min-w-[20px] flex items-center justify-center text-xs px-1.5", isMobile && "h-4 min-w-[16px] text-[10px] px-1")}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </button>
    );
  };

  const renderCollapsedCategory = (category: SidebarCategory) => (
    <div key={category.id} className="space-y-1">
      <div className="flex justify-center py-1">
        <div className={cn("w-1.5 h-1.5 rounded-full", category.color.replace('text-', 'bg-'))} />
      </div>
      <div className="space-y-1 px-1">
        {category.items.map(item => (
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

  const renderExpandedCategory = (category: SidebarCategory, index?: number) => {
    const isOpen = openCategories.includes(category.id);
    const hasActiveItem = category.items.some(item => item.id === activeTab);
    const CatIcon = getIcon(category.icon);

    return (
      <Collapsible key={category.id} open={isOpen} onOpenChange={() => toggleCategory(category.id)}>
        <div className="flex items-center group">
          <CollapsibleTrigger asChild>
            <button className={cn(
              "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              isMobile && "gap-2 px-2 py-1.5",
              "hover:bg-sidebar-accent/50", hasActiveItem && "bg-sidebar-accent/30"
            )}>
              <CatIcon className={cn("w-5 h-5 flex-shrink-0", isMobile && "w-4 h-4", category.color)} />
              {renamingCategory === category.id ? (
                <Input
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => handleFinishRename(category.id)}
                  onKeyDown={e => e.key === 'Enter' && handleFinishRename(category.id)}
                  className="h-6 text-sm py-0"
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className={cn("text-sm font-semibold flex-1 text-left", isMobile && "text-xs")}>{category.label}</span>
              )}
              <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isMobile && "w-3 h-3", isOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          {editMode && (
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
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
                            <div className="flex-1">{renderMenuItem(item)}</div>
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
            category.items.map(renderMenuItem)
          )}
        </CollapsibleContent>
      </Collapsible>
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
      <div className="p-3 border-b border-sidebar-border flex justify-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                <img src={logoIcon} alt="MalagaMicro" className="w-9 h-9 object-contain" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right"><p className="font-bold">MalagaMicro CRM</p></TooltipContent>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white px-2">
              <img src={logoFull} alt="MalagaMicro CRM" className="h-8 object-contain" />
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {expandedNavContent}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        {editToggle}
        {user && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">{user.email}</div>
        )}
        <button
          onClick={() => handleTabChange('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all min-h-[44px]",
            "hover:bg-sidebar-accent", activeTab === 'settings' && "bg-sidebar-accent"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Ajustes</span>
        </button>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all min-h-[44px] hover:bg-sidebar-accent text-destructive hover:text-destructive/80"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Cerrar sesión</span>
        </button>
        <SidebarToggle collapsed={collapsed} onToggle={() => setCollapsed(true)} />
      </div>
    </>
  );

  // Mobile content
  const mobileContent = (
    <>
      <div className="p-2.5 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white px-1.5">
              <img src={logoFull} alt="MalagaMicro CRM" className="h-6 object-contain" />
            </div>
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
          "bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col",
          !isMobile && "h-screen",
          !isMobile && (collapsed ? "w-[60px]" : "w-64"),
          isMobile && "fixed inset-y-0 left-0 z-50 w-60",
          isMobile && (mobileOpen ? "translate-x-0" : "-translate-x-full")
        )}
      >
        {isMobile ? mobileContent : (collapsed ? collapsedContent : expandedContent)}
      </aside>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--sidebar-border)); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--sidebar-foreground) / 0.3); }
      `}</style>
    </>
  );
}
