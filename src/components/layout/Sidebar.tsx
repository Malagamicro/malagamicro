import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  Search, 
  Mail, 
  MessageSquare, 
  MessagesSquare,
  MapPin, 
  Settings,
  LogOut,
  Kanban,
  BarChart3,
  Sun,
  Moon,
  Inbox,
  FileText,
  Globe,
  Ticket,
  FolderOpen,
  Bot,
  Cloud,
  Calculator,
  Menu,
  X,
  Bell,
  Megaphone,
  Briefcase,
  Wrench,
  MessageCircle,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useIsMobile } from '@/hooks/use-mobile';
import logoFull from '@/assets/logo-full.png';
import logoIcon from '@/assets/logo-icon.png';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  showBadge?: boolean;
  route?: string;
}

interface MenuCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: MenuItem[];
}

const menuCategories: MenuCategory[] = [
  {
    id: 'main',
    label: 'Principal',
    icon: LayoutDashboard,
    color: 'text-blue-500',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
      { id: 'reports', label: 'Reportes', icon: BarChart3, color: 'text-orange-500' },
    ]
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Briefcase,
    color: 'text-indigo-500',
    items: [
      { id: 'leads', label: 'Leads', icon: Users, color: 'text-indigo-500' },
      { id: 'pipeline', label: 'Pipeline', icon: Kanban, color: 'text-purple-500' },
      { id: 'prospeccion', label: 'Prospección', icon: Search, color: 'text-cyan-500' },
      { id: 'mapa', label: 'Mapa', icon: MapPin, color: 'text-red-500' },
    ]
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    color: 'text-pink-500',
    items: [
      { id: 'campaigns', label: 'Campañas Email', icon: Mail, color: 'text-pink-500' },
      { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-green-500' },
      { id: 'templates', label: 'Plantillas', icon: FileText, color: 'text-amber-500' },
    ]
  },
  {
    id: 'comunicacion',
    label: 'Comunicación',
    icon: MessageCircle,
    color: 'text-teal-500',
    items: [
      { id: 'inbox', label: 'Inbox', icon: Inbox, showBadge: true, color: 'text-teal-500' },
      { id: 'mensajes', label: 'Chat Interno', icon: MessagesSquare, color: 'text-sky-500' },
      { id: 'osticket', label: 'Tickets', icon: Ticket, color: 'text-yellow-500' },
    ]
  },
  {
    id: 'gestion',
    label: 'Gestión',
    icon: Calculator,
    color: 'text-emerald-500',
    items: [
      { id: 'presupuesto', label: 'Presupuestos', icon: Calculator, color: 'text-emerald-500' },
      { id: 'reminders', label: 'Recordatorios', icon: Bell, route: '/reminders', color: 'text-rose-400' },
      { id: 'shared-files', label: 'Archivos', icon: Cloud, color: 'text-slate-400' },
    ]
  },
  {
    id: 'herramientas',
    label: 'Herramientas',
    icon: Wrench,
    color: 'text-lime-500',
    items: [
      { id: 'chat-ai', label: 'Chat IA', icon: Bot, color: 'text-violet-500' },
      { id: 'seo-generator', label: 'Generador SEO', icon: Sparkles, route: '/tools/seo', color: 'text-amber-500' },
      { id: 'scraper', label: 'Scraper', icon: Globe, route: '/tools/scraper', color: 'text-lime-500' },
      { id: 'files', label: 'Gestor Archivos', icon: FolderOpen, route: '/tools/files', color: 'text-rose-500' },
    ]
  },
];

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
      {/* Animated indicator bar */}
      <div 
        className={cn(
          "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary rounded-full transition-all duration-300",
          collapsed ? "w-4" : "w-12"
        )}
      />
    </button>
  );
}

// Collapsed Icon Button with Tooltip
function CollapsedIconButton({ 
  item, 
  isActive, 
  onClick, 
  unreadCount 
}: { 
  item: MenuItem; 
  isActive: boolean; 
  onClick: () => void;
  unreadCount?: number;
}) {
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
            <item.icon className={cn("w-5 h-5", item.color)} />
            {item.showBadge && unreadCount && unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(['main', 'crm', 'marketing']);
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { unreadCount } = useNotificationContext();
  const isMobile = useIsMobile();

  useEffect(() => {
    const categoryWithActiveTab = menuCategories.find(cat => 
      cat.items.some(item => item.id === activeTab)
    );
    if (categoryWithActiveTab && !openCategories.includes(categoryWithActiveTab.id)) {
      setOpenCategories(prev => [...prev, categoryWithActiveTab.id]);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
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

  const handleSignOut = async () => {
    await signOut();
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.route) {
      navigate(item.route);
      if (isMobile) setMobileOpen(false);
    } else {
      handleTabChange(item.id);
    }
  };

  const renderMenuItem = (item: MenuItem) => {
    const isActive = activeTab === item.id;
    
    return (
      <button
        key={item.id}
        onClick={() => handleItemClick(item)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 relative min-h-[40px]",
          "hover:bg-sidebar-accent",
          isActive && "bg-sidebar-accent"
        )}
      >
        <div className="relative">
          <item.icon className={cn("w-4 h-4 flex-shrink-0", item.color)} />
        </div>
        <span className="text-sm font-medium animate-fade-in flex-1 text-left">
          {item.label}
        </span>
        {item.showBadge && unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="h-5 min-w-[20px] flex items-center justify-center text-xs px-1.5"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </button>
    );
  };

  const renderCollapsedCategory = (category: MenuCategory) => {
    return (
      <div key={category.id} className="space-y-1">
        {/* Category indicator dot */}
        <div className="flex justify-center py-1">
          <div className={cn("w-1.5 h-1.5 rounded-full", category.color.replace('text-', 'bg-'))} />
        </div>
        {/* Category items */}
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
  };

  const renderExpandedCategory = (category: MenuCategory) => {
    const isOpen = openCategories.includes(category.id);
    const hasActiveItem = category.items.some(item => item.id === activeTab);

    return (
      <Collapsible
        key={category.id}
        open={isOpen}
        onOpenChange={() => toggleCategory(category.id)}
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              "hover:bg-sidebar-accent/50",
              hasActiveItem && "bg-sidebar-accent/30"
            )}
          >
            <category.icon className={cn("w-5 h-5 flex-shrink-0", category.color)} />
            <span className="text-sm font-semibold flex-1 text-left">{category.label}</span>
            <ChevronDown 
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                isOpen && "rotate-180"
              )} 
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-3 space-y-0.5 mt-1 animate-accordion-down">
          {category.items.map(renderMenuItem)}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Collapsed sidebar content
  const collapsedContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-3 border-b border-sidebar-border flex justify-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                <img src={logoIcon} alt="MalagaMicro" className="w-9 h-9 object-contain" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-bold">MalagaMicro CRM</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Navigation with custom scrollbar */}
      <nav className="flex-1 py-3 overflow-y-auto custom-scrollbar">
        <div className="space-y-3 flex flex-col items-center">
          {menuCategories.map(renderCollapsedCategory)}
        </div>
      </nav>

      {/* Bottom actions */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {/* Theme toggle */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl hover:bg-sidebar-accent transition-all duration-200 hover:scale-105"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Settings */}
        <CollapsedIconButton
          item={{ id: 'settings', label: 'Ajustes', icon: Settings, color: '' }}
          isActive={activeTab === 'settings'}
          onClick={() => handleTabChange('settings')}
        />

        {/* Logout */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl hover:bg-sidebar-accent transition-all duration-200 text-destructive hover:scale-105"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Cerrar sesión</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Toggle */}
        <div className="pt-2">
          <SidebarToggle collapsed={collapsed} onToggle={() => setCollapsed(false)} />
        </div>
      </div>
    </div>
  );

  // Expanded sidebar content
  const expandedContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white px-2">
              <img src={logoFull} alt="MalagaMicro CRM" className="h-8 object-contain" />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {menuCategories.map(renderExpandedCategory)}
      </nav>

      {/* User info & Settings & Logout */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {user && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">
            {user.email}
          </div>
        )}
        
        <button
          onClick={() => handleTabChange('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all min-h-[44px]",
            "hover:bg-sidebar-accent",
            activeTab === 'settings' && "bg-sidebar-accent"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Ajustes</span>
        </button>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all min-h-[44px] hover:bg-sidebar-accent text-destructive hover:text-destructive/80"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Cerrar sesión</span>
        </button>
        
        <SidebarToggle collapsed={collapsed} onToggle={() => setCollapsed(true)} />
      </div>
    </>
  );

  // Mobile sidebar content (always expanded)
  const mobileContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white px-2">
              <img src={logoFull} alt="MalagaMicro CRM" className="h-8 object-contain" />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {menuCategories.map(renderExpandedCategory)}
      </nav>

      {/* User info & Settings & Logout */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {user && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">
            {user.email}
          </div>
        )}
        
        <button
          onClick={() => handleTabChange('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all min-h-[44px]",
            "hover:bg-sidebar-accent",
            activeTab === 'settings' && "bg-sidebar-accent"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Ajustes</span>
        </button>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all min-h-[44px] hover:bg-sidebar-accent text-destructive hover:text-destructive/80"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Cerrar sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      {isMobile && (
        <Button
          data-sidebar-trigger
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-40 h-11 w-11 bg-background/80 backdrop-blur-sm border shadow-sm"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        data-sidebar
        className={cn(
          "bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col",
          !isMobile && "h-screen",
          !isMobile && (collapsed ? "w-[60px]" : "w-64"),
          isMobile && "fixed inset-y-0 left-0 z-50 w-72",
          isMobile && (mobileOpen ? "translate-x-0" : "-translate-x-full")
        )}
      >
        {isMobile ? mobileContent : (collapsed ? collapsedContent : expandedContent)}
      </aside>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--sidebar-border));
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--sidebar-foreground) / 0.3);
        }
      `}</style>
    </>
  );
}
