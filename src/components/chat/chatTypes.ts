import { Brain, Sparkles, Zap, Pencil } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  subagent?: string;
  subagentEmoji?: string;
  subagentColor?: string;
  isImage?: boolean;
  imageUrls?: string[];
  isDelegationNotice?: boolean;
}

export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  content?: string;
  url?: string;
}

export const MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', icon: Sparkles, color: 'text-emerald-500' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', icon: Sparkles, color: 'text-violet-500' },
  { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', icon: Zap, color: 'text-amber-500' },
  { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', icon: Brain, color: 'text-indigo-500' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', icon: Brain, color: 'text-orange-500' },
  { id: 'custom', name: 'Personalizado', icon: Pencil, color: 'text-muted-foreground' },
];

export const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/perplexity-chat`;

export const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.yaml', '.yml', '.log', '.sql'];
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
export const ALLOWED_EXTENSIONS = [...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS, '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx'];

export const isTextFile = (fileName: string) => TEXT_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
export const isImageFile = (fileName: string) => IMAGE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
