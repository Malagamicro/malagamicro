import { FileText, Layout, ListChecks, Palette, FolderOpen, Bot, MessageCircle, Circle, Clock, CheckCircle2, Shield, Pencil, Eye } from 'lucide-react';

export const PAGE_TYPES = [
  { value: 'note', label: 'Nota', icon: '📝', lucide: FileText },
  { value: 'kanban', label: 'Kanban', icon: '📊', lucide: Layout },
  { value: 'tasks', label: 'Tareas', icon: '✅', lucide: ListChecks },
  { value: 'canvas', label: 'Pizarra', icon: '🎨', lucide: Palette },
  { value: 'files', label: 'Archivos', icon: '📁', lucide: FolderOpen },
  { value: 'ai_chat', label: 'Chat IA', icon: '🤖', lucide: Bot },
  { value: 'team_chat', label: 'Chat equipo', icon: '💬', lucide: MessageCircle },
];

export const TASK_STATUSES = [
  { value: 'todo', label: 'Por hacer', icon: Circle, color: 'text-muted-foreground' },
  { value: 'in_progress', label: 'En progreso', icon: Clock, color: 'text-amber-500' },
  { value: 'done', label: 'Hecho', icon: CheckCircle2, color: 'text-green-500' },
];

export const PRIORITIES = [
  { value: 'low', label: 'Baja', color: 'bg-blue-500/10 text-blue-600' },
  { value: 'normal', label: 'Normal', color: 'bg-muted text-muted-foreground' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500/10 text-orange-600' },
  { value: 'urgent', label: 'Urgente', color: 'bg-destructive/10 text-destructive' },
];

export const ROLE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  owner: { label: 'Propietario', icon: Shield, color: 'text-amber-500' },
  editor: { label: 'Editor', icon: Pencil, color: 'text-blue-500' },
  reader: { label: 'Lector', icon: Eye, color: 'text-muted-foreground' },
};

export const AI_MODELS = [
  { value: 'openrouter/hunter-alpha', label: 'Hunter Alpha' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];
