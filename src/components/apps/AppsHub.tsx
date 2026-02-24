import { cn } from '@/lib/utils';
import {
  Mail, MessageSquare, FileText, Inbox, MessagesSquare, Ticket,
  Calendar, BarChart3, Bell, Cloud, Bot, FileEdit, Sparkles, Megaphone,
} from 'lucide-react';

interface AppCard {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGradient: string;
}

const APP_CATEGORIES = [
  {
    label: 'Comunicación',
    apps: [
      { id: 'inbox', label: 'Inbox', description: 'Notificaciones', icon: Inbox, color: 'text-teal-500', bgGradient: 'from-teal-500/20 to-teal-600/10' },
      { id: 'correo', label: 'Correo', description: 'Email completo', icon: Mail, color: 'text-blue-500', bgGradient: 'from-blue-500/20 to-blue-600/10' },
      { id: 'mensajes', label: 'Chat Interno', description: 'Mensajería del equipo', icon: MessagesSquare, color: 'text-sky-500', bgGradient: 'from-sky-500/20 to-sky-600/10' },
      { id: 'osticket', label: 'Tickets', description: 'Soporte osTicket', icon: Ticket, color: 'text-yellow-500', bgGradient: 'from-yellow-500/20 to-yellow-600/10' },
    ],
  },
  {
    label: 'Marketing',
    apps: [
      { id: 'campaigns', label: 'Campañas', description: 'Email marketing', icon: Megaphone, color: 'text-pink-500', bgGradient: 'from-pink-500/20 to-pink-600/10' },
      { id: 'whatsapp', label: 'WhatsApp', description: 'Mensajería directa', icon: MessageSquare, color: 'text-green-500', bgGradient: 'from-green-500/20 to-green-600/10' },
      { id: 'templates', label: 'Plantillas', description: 'Mensajes predefinidos', icon: FileText, color: 'text-amber-500', bgGradient: 'from-amber-500/20 to-amber-600/10' },
    ],
  },
  {
    label: 'Gestión',
    apps: [
      { id: 'calendario', label: 'Calendario', description: 'Eventos y citas', icon: Calendar, color: 'text-blue-500', bgGradient: 'from-blue-500/20 to-blue-600/10' },
      { id: 'informes', label: 'Informes', description: 'Reportes detallados', icon: BarChart3, color: 'text-emerald-500', bgGradient: 'from-emerald-500/20 to-emerald-600/10' },
      { id: 'reminders', label: 'Recordatorios', description: 'Alertas y tareas', icon: Bell, color: 'text-rose-400', bgGradient: 'from-rose-500/20 to-rose-600/10' },
      { id: 'shared-files', label: 'Archivos', description: 'Almacenamiento compartido', icon: Cloud, color: 'text-slate-500', bgGradient: 'from-slate-500/20 to-slate-600/10' },
    ],
  },
  {
    label: 'Herramientas IA',
    apps: [
      { id: 'chat-ai', label: 'Chat IA', description: 'Asistente inteligente', icon: Bot, color: 'text-violet-500', bgGradient: 'from-violet-500/20 to-violet-600/10' },
      { id: 'editor', label: 'Editor IA', description: 'Documentos con IA', icon: FileEdit, color: 'text-emerald-500', bgGradient: 'from-emerald-500/20 to-emerald-600/10' },
      { id: 'seo-generator', label: 'SEO Generator', description: 'Artículos optimizados', icon: Sparkles, color: 'text-amber-500', bgGradient: 'from-amber-500/20 to-amber-600/10' },
    ],
  },
];

interface AppsHubProps {
  onOpenApp: (appId: string) => void;
}

export function AppsHub({ onOpenApp }: AppsHubProps) {
  return (
    <div className="p-4 sm:p-8 animate-fade-in max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Aplicaciones</h1>
        <p className="text-sm text-muted-foreground mt-1">Accede a todas las herramientas y utilidades</p>
      </div>

      {APP_CATEGORIES.map((category) => (
        <div key={category.label}>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{category.label}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {category.apps.map((app) => (
              <button
                key={app.id}
                onClick={() => onOpenApp(app.id)}
                className={cn(
                  'group flex flex-col items-center gap-2.5 p-5 rounded-2xl border border-border/50',
                  'bg-gradient-to-br', app.bgGradient,
                  'hover:shadow-lg hover:scale-[1.03] hover:border-primary/30',
                  'transition-all duration-200 active:scale-[0.98]'
                )}
              >
                <div className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center',
                  'bg-background/80 shadow-sm',
                  'group-hover:shadow-md transition-shadow'
                )}>
                  <app.icon className={cn('w-6 h-6', app.color)} />
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-foreground block">{app.label}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{app.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
