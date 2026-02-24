import { useState, useEffect, useMemo } from 'react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import {
  LayoutDashboard, Users, Search, Mail, MessageSquare, MessagesSquare,
  MapPin, Settings, Kanban, BarChart3, Inbox, FileText, Globe,
  Ticket, FolderOpen, Bot, Cloud, Calculator, Bell, Megaphone,
  Briefcase, Wrench, MessageCircle, Sparkles, Calendar as CalendarIcon,
  LayoutGrid, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Search, Mail, MessageSquare, MessagesSquare,
  MapPin, Settings, Kanban, BarChart3, Inbox, FileText, Globe,
  Ticket, FolderOpen, Bot, Cloud, Calculator, Bell, Megaphone,
  Briefcase, Wrench, MessageCircle, Sparkles, Calendar: CalendarIcon,
  LayoutGrid,
};

interface NavAction {
  id: string;
  label: string;
  description?: string;
  icon: string;
  color: string;
  group: string;
  keywords?: string[];
}

const NAV_ACTIONS: NavAction[] = [
  // Principal
  { id: 'dashboard', label: 'Dashboard', description: 'Vista general', icon: 'LayoutDashboard', color: 'text-blue-500', group: 'Navegar', keywords: ['inicio', 'home'] },
  { id: 'apps', label: 'Aplicaciones', description: 'Hub de apps', icon: 'LayoutGrid', color: 'text-violet-500', group: 'Navegar', keywords: ['herramientas', 'tools'] },
  // CRM
  { id: 'leads', label: 'Leads', description: 'Gestionar clientes potenciales', icon: 'Users', color: 'text-indigo-500', group: 'CRM', keywords: ['clientes', 'contactos', 'ventas'] },
  { id: 'pipeline', label: 'Pipeline', description: 'Embudo de ventas', icon: 'Kanban', color: 'text-purple-500', group: 'CRM', keywords: ['kanban', 'embudo', 'funnel'] },
  { id: 'prospeccion', label: 'Prospección', description: 'Buscar nuevos clientes', icon: 'Search', color: 'text-cyan-500', group: 'CRM', keywords: ['buscar', 'empresas'] },
  { id: 'mapa', label: 'Mapa de Leads', description: 'Vista geográfica', icon: 'MapPin', color: 'text-red-500', group: 'CRM', keywords: ['ubicacion', 'geo'] },
  // Comunicación
  { id: 'correo', label: 'Correo', description: 'Email profesional', icon: 'Mail', color: 'text-sky-500', group: 'Comunicación', keywords: ['email', 'enviar'] },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Mensajería', icon: 'MessageSquare', color: 'text-green-500', group: 'Comunicación', keywords: ['mensaje', 'chat'] },
  { id: 'mensajes', label: 'Chat Interno', description: 'Comunicación del equipo', icon: 'MessagesSquare', color: 'text-emerald-500', group: 'Comunicación', keywords: ['equipo', 'interno'] },
  { id: 'inbox', label: 'Bandeja', description: 'Notificaciones', icon: 'Inbox', color: 'text-amber-500', group: 'Comunicación', keywords: ['notificaciones'] },
  // Herramientas
  { id: 'calendario', label: 'Calendario', description: 'Eventos y citas', icon: 'Calendar', color: 'text-teal-500', group: 'Herramientas', keywords: ['eventos', 'citas', 'agenda'] },
  { id: 'informes', label: 'Informes', description: 'Análisis y métricas', icon: 'BarChart3', color: 'text-orange-500', group: 'Herramientas', keywords: ['reportes', 'analytics', 'estadísticas'] },
  { id: 'osticket', label: 'Tickets', description: 'Soporte técnico', icon: 'Ticket', color: 'text-rose-500', group: 'Herramientas', keywords: ['soporte', 'incidencias'] },
  { id: 'shared-files', label: 'Archivos', description: 'Documentos compartidos', icon: 'FolderOpen', color: 'text-amber-500', group: 'Herramientas', keywords: ['documentos', 'ficheros'] },
  { id: 'editor', label: 'Editor', description: 'Documentos con IA', icon: 'FileText', color: 'text-violet-500', group: 'Herramientas', keywords: ['documento', 'escribir'] },
  { id: 'chat-ai', label: 'Chat IA', description: 'Asistente inteligente', icon: 'Bot', color: 'text-purple-500', group: 'Herramientas', keywords: ['ia', 'ai', 'perplexity'] },
  { id: 'campaigns', label: 'Campañas', description: 'Email marketing', icon: 'Megaphone', color: 'text-pink-500', group: 'Marketing', keywords: ['marketing', 'email masivo'] },
  { id: 'templates', label: 'Plantillas', description: 'Mensajes predefinidos', icon: 'FileText', color: 'text-slate-400', group: 'Marketing', keywords: ['template'] },
  { id: 'seo-generator', label: 'Generador SEO', description: 'Artículos optimizados', icon: 'Globe', color: 'text-green-500', group: 'Marketing', keywords: ['seo', 'articulo', 'blog'] },
  { id: 'reminders', label: 'Recordatorios', description: 'Tareas pendientes', icon: 'Bell', color: 'text-yellow-500', group: 'Herramientas', keywords: ['tareas', 'avisos'] },
  // Config
  { id: 'settings', label: 'Ajustes', description: 'Configuración', icon: 'Settings', color: 'text-slate-400', group: 'Sistema', keywords: ['config', 'perfil'] },
];

interface CommandPaletteProps {
  onNavigate: (tabId: string) => void;
}

export function CommandPalette({ onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, NavAction[]>();
    for (const action of NAV_ACTIONS) {
      const existing = map.get(action.group) || [];
      existing.push(action);
      map.set(action.group, existing);
    }
    return map;
  }, []);

  const handleSelect = (id: string) => {
    onNavigate(id);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar módulo, acción o herramienta..." />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
        {Array.from(groups.entries()).map(([groupName, actions], idx) => (
          <div key={groupName}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={groupName}>
              {actions.map(action => {
                const Icon = ICON_MAP[action.icon] || LayoutDashboard;
                return (
                  <CommandItem
                    key={action.id}
                    value={`${action.label} ${action.description || ''} ${(action.keywords || []).join(' ')}`}
                    onSelect={() => handleSelect(action.id)}
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg bg-muted/80")}>
                      <Icon className={cn("w-4 h-4", action.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      {action.description && (
                        <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                      )}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
