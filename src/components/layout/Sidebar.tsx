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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useIsMobile } from '@/hooks/use-mobile';

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

// Categorías del menú
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
      { id: 'scraper', label: 'Scraper', icon: Globe, route: '/tools/scraper', color: 'text-lime-500' },
      { id: 'files', label: 'Gestor Archivos', icon: FolderOpen, route: '/tools/files', color: 'text-rose-500' },
    ]
  },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(['main', 'crm', 'marketing']);
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { unreadCount } = useNotificationContext();
  const isMobile = useIsMobile();

  // Find which category contains the active tab and open it
  useEffect(() => {
    const categoryWithActiveTab = menuCategories.find(cat => 
      cat.items.some(item => item.id === activeTab)
    );
    if (categoryWithActiveTab && !openCategories.includes(categoryWithActiveTab.id)) {
      setOpenCategories(prev => [...prev, categoryWithActiveTab.id]);
    }
  }, [activeTab]);

  // Close mobile sidebar when tab changes
  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [activeTab, isMobile]);

  // Close mobile sidebar when clicking outside
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

  const renderMenuItem = (item: MenuItem) => {
    const isActive = activeTab === item.id;
    
    return (
      <button
        key={item.id}
        onClick={() => {
          if (item.route) {
            navigate(item.route);
            if (isMobile) setMobileOpen(false);
          } else {
            handleTabChange(item.id);
          }
        }}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 relative min-h-[40px]",
          "hover:bg-sidebar-accent",
          isActive && "bg-sidebar-accent"
        )}
      >
        <div className="relative">
          <item.icon className={cn("w-4 h-4 flex-shrink-0", item.color)} />
          {item.showBadge && unreadCount > 0 && collapsed && !isMobile && (
            <span className="absolute -top-1 -right-1 h-3 min-w-[12px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-0.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {(!collapsed || isMobile) && (
          <>
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
          </>
        )}
      </button>
    );
  };

  const renderCategory = (category: MenuCategory) => {
    const isOpen = openCategories.includes(category.id);
    const hasActiveItem = category.items.some(item => item.id === activeTab);
    
    // In collapsed mode, show only icons
    if (collapsed && !isMobile) {
      return (
        <div key={category.id} className="space-y-0.5">
          {category.items.map(item => (
            <button
              key={item.id}
              onClick={() => {
                if (item.route) {
                  navigate(item.route);
                } else {
                  handleTabChange(item.id);
                }
              }}
              className={cn(
                "w-full flex items-center justify-center py-2.5 rounded-lg transition-all duration-200 relative",
                "hover:bg-sidebar-accent",
                activeTab === item.id && "bg-sidebar-accent"
              )}
              title={item.label}
            >
              <div className="relative">
                <item.icon className={cn("w-5 h-5", item.color)} />
                {item.showBadge && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      );
    }

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
        <CollapsibleContent className="pl-3 space-y-0.5 mt-1">
          {category.items.map(renderMenuItem)}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sidebar-accent flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            {(!collapsed || isMobile) && (
              <div className="animate-fade-in">
                <h1 className="font-bold text-lg leading-tight">MalagaMicro</h1>
                <p className="text-xs opacity-70">CRM</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(!collapsed || isMobile) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {menuCategories.map(renderCategory)}
      </nav>

      {/* User info & Settings & Logout & Collapse */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {/* User email */}
        {(!collapsed || isMobile) && user && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">
            {user.email}
          </div>
        )}
        
        <button
          onClick={() => handleTabChange('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all min-h-[44px]",
            "hover:bg-sidebar-accent",
            activeTab === 'settings' && "bg-sidebar-accent",
            collapsed && !isMobile && "justify-center"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || isMobile) && <span className="text-sm font-medium">Ajustes</span>}
        </button>

        <button
          onClick={handleSignOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all min-h-[44px]",
            "hover:bg-sidebar-accent text-destructive hover:text-destructive/80",
            collapsed && !isMobile && "justify-center"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || isMobile) && <span className="text-sm font-medium">Cerrar sesión</span>}
        </button>
        
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent min-h-[44px]"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        )}
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
          // Desktop styles
          !isMobile && "h-screen",
          !isMobile && (collapsed ? "w-16" : "w-64"),
          // Mobile styles
          isMobile && "fixed inset-y-0 left-0 z-50 w-72",
          isMobile && (mobileOpen ? "translate-x-0" : "-translate-x-full")
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
