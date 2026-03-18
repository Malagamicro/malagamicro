import {
  LayoutDashboard, Users, Search, Mail, MessageSquare, MessagesSquare,
  MapPin, Settings, Kanban, BarChart3, Inbox, FileText, Globe,
  Ticket, FolderOpen, Bot, Cloud, Calculator, Bell, Megaphone,
  Briefcase, Wrench, MessageCircle, Sparkles, FolderPlus,
  Calendar as CalendarIcon, ExternalLink, Link, FileEdit, LayoutGrid, StickyNote,
} from 'lucide-react';
import type { SidebarItem } from '@/hooks/useSidebarConfig';

export const APP_VERSION = 'v2.9.0';
export const APP_BUILD_DATE = '2026-02-25 12:00';

// Icon registry
export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Search, Mail, MessageSquare, MessagesSquare,
  MapPin, Settings, Kanban, BarChart3, Inbox, FileText, Globe,
  Ticket, FolderOpen, Bot, Cloud, Calculator, Bell, Megaphone,
  Briefcase, Wrench, MessageCircle, Sparkles, FolderPlus, Calendar: CalendarIcon,
  ExternalLink, Link, FileEdit, LayoutGrid, StickyNote,
};

export const ICON_OPTIONS = Object.keys(ICON_MAP);

export const COLOR_OPTIONS = [
  'text-blue-500', 'text-indigo-500', 'text-purple-500', 'text-pink-500',
  'text-red-500', 'text-orange-500', 'text-amber-500', 'text-yellow-500',
  'text-lime-500', 'text-green-500', 'text-emerald-500', 'text-teal-500',
  'text-cyan-500', 'text-sky-500', 'text-violet-500', 'text-rose-500',
  'text-slate-400',
];

export const BG_COLOR_OPTIONS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#64748b', '#78716c',
];

export function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] || LayoutDashboard;
}

// Available internal apps that can be added to the sidebar
export const AVAILABLE_APPS: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', color: 'text-blue-500' },
  { id: 'leads', label: 'Leads', icon: 'Users', color: 'text-indigo-500' },
  { id: 'pipeline', label: 'Pipeline', icon: 'Kanban', color: 'text-purple-500' },
  { id: 'prospeccion', label: 'Prospección', icon: 'Search', color: 'text-cyan-500' },
  { id: 'mapa', label: 'Mapa', icon: 'MapPin', color: 'text-red-500' },
  { id: 'notas', label: 'Notas', icon: 'StickyNote', color: 'text-amber-500' },
  { id: 'apps', label: 'Aplicaciones', icon: 'LayoutGrid', color: 'text-violet-500' },
  { id: 'calendario', label: 'Calendario', icon: 'Calendar', color: 'text-green-500' },
  { id: 'correo', label: 'Correo', icon: 'Mail', color: 'text-sky-500' },
  { id: 'inbox', label: 'Bandeja', icon: 'Inbox', color: 'text-blue-400' },
  { id: 'mensajes', label: 'Chat Interno', icon: 'MessagesSquare', color: 'text-emerald-500' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', color: 'text-green-500' },
  { id: 'osticket', label: 'Tickets', icon: 'Ticket', color: 'text-orange-500' },
  { id: 'campaigns', label: 'Campañas', icon: 'Megaphone', color: 'text-pink-500' },
  { id: 'templates', label: 'Plantillas', icon: 'FileText', color: 'text-slate-400' },
  { id: 'informes', label: 'Informes', icon: 'BarChart3', color: 'text-teal-500' },
  { id: 'reminders', label: 'Recordatorios', icon: 'Bell', color: 'text-amber-500' },
  { id: 'shared-files', label: 'Archivos', icon: 'FolderOpen', color: 'text-yellow-500' },
  { id: 'chat-ai', label: 'Chat IA', icon: 'Bot', color: 'text-violet-500' },
  { id: 'editor', label: 'Editor', icon: 'FileEdit', color: 'text-blue-500' },
  { id: 'seo-generator', label: 'SEO', icon: 'Globe', color: 'text-green-500' },
  { id: 'settings', label: 'Ajustes', icon: 'Settings', color: 'text-slate-400' },
];
