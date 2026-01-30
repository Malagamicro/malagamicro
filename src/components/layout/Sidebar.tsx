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
  Building2,
  LogOut,
  Kanban,
  BarChart3,
  Sun,
  Moon,
  Inbox,
  FileText,
  Globe,
  FolderOpen,
  Bot,
  Cloud,
  Calculator,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'pipeline', label: 'Pipeline', icon: Kanban },
  { id: 'prospeccion', label: 'Prospección', icon: Search },
  { id: 'campaigns', label: 'Campañas', icon: Mail },
  { id: 'mapa', label: 'Mapa', icon: MapPin },
  { id: 'reports', label: 'Reportes', icon: BarChart3 },
  { id: 'inbox', label: 'Inbox', icon: Inbox, showBadge: true },
  { id: 'mensajes', label: 'Mensajes', icon: MessagesSquare },
  { id: 'shared-files', label: 'Archivos', icon: Cloud },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'templates', label: 'Plantillas', icon: FileText },
  { id: 'presupuesto', label: 'Presupuesto', icon: Calculator },
  { id: 'chat-ai', label: 'Chat IA', icon: Bot },
];

const toolsItems = [
  { id: 'scraper', label: 'Scraper', icon: Globe, route: '/tools/scraper' },
  { id: 'files', label: 'Archivos', icon: FolderOpen, route: '/tools/files' },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { unreadCount } = useNotificationContext();
  const isMobile = useIsMobile();

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
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative min-h-[44px]",
              "hover:bg-sidebar-accent",
              activeTab === item.id && "bg-sidebar-accent"
            )}
          >
            <div className="relative">
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {/* Badge for collapsed state */}
              {item.showBadge && unreadCount > 0 && collapsed && !isMobile && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            {(!collapsed || isMobile) && (
              <>
                <span className="text-sm font-medium animate-fade-in flex-1 text-left">
                  {item.label}
                </span>
                {/* Badge for expanded state */}
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
        ))}

        {/* Separator */}
        {(!collapsed || isMobile) && (
          <div className="pt-3 pb-1">
            <span className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Herramientas
            </span>
          </div>
        )}
        {collapsed && !isMobile && <div className="h-3" />}

        {/* Tools */}
        {toolsItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              navigate(item.route);
              if (isMobile) setMobileOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 min-h-[44px]",
              "hover:bg-sidebar-accent"
            )}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {(!collapsed || isMobile) && (
              <span className="text-sm font-medium animate-fade-in">{item.label}</span>
            )}
          </button>
        ))}
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
            activeTab === 'settings' && "bg-sidebar-accent"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || isMobile) && <span className="text-sm font-medium">Ajustes</span>}
        </button>

        <button
          onClick={handleSignOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all min-h-[44px]",
            "hover:bg-sidebar-accent text-destructive hover:text-destructive/80"
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