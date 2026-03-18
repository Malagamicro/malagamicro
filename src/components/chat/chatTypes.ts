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
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', icon: Brain, color: 'text-emerald-500' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', icon: Sparkles, color: 'text-blue-500' },
  { id: 'openai/gpt-5', name: 'GPT-5', icon: Sparkles, color: 'text-violet-500' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini Flash', icon: Zap, color: 'text-amber-500' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini Pro', icon: Brain, color: 'text-indigo-500' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet', icon: Brain, color: 'text-orange-500' },
  { id: 'openai/gpt-5.2', name: 'GPT-5.2', icon: Sparkles, color: 'text-cyan-500' },
  { id: 'custom', name: 'Personalizado', icon: Pencil, color: 'text-muted-foreground' },
];

export const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/perplexity-chat`;

export const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.yaml', '.yml', '.log', '.sql'];
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
export const ALLOWED_EXTENSIONS = [...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS, '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx'];

export const isTextFile = (fileName: string) => TEXT_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
export const isImageFile = (fileName: string) => IMAGE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
