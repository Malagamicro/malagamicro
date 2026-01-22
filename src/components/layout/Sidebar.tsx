import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  Search, 
  Mail, 
  MessageSquare, 
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';

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
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'templates', label: 'Plantillas', icon: FileText },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <aside 
      className={cn(
        "h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sidebar-accent flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            {!collapsed && (
              <div className="animate-fade-in">
                <h1 className="font-bold text-lg leading-tight">MalagaMicro</h1>
                <p className="text-xs opacity-70">CRM</p>
              </div>
            )}
          </div>
          {!collapsed && (
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
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              "hover:bg-sidebar-accent",
              activeTab === item.id && "bg-sidebar-accent"
            )}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="text-sm font-medium animate-fade-in">{item.label}</span>
            )}
          </button>
        ))}
      </nav>

      {/* User info & Settings & Logout & Collapse */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {/* User email */}
        {!collapsed && user && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">
            {user.email}
          </div>
        )}
        
        <button
          onClick={() => onTabChange('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
            "hover:bg-sidebar-accent",
            activeTab === 'settings' && "bg-sidebar-accent"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Ajustes</span>}
        </button>

        <button
          onClick={handleSignOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
            "hover:bg-sidebar-accent text-red-400 hover:text-red-300"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Cerrar sesión</span>}
        </button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </aside>
  );
}
